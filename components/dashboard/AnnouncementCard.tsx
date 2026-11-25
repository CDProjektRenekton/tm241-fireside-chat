'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnounceSummary } from '@/lib/announce';
import { EVENT } from '@/lib/config';
import { Alert, Check, Mail, Refresh } from '../Icons';

type Version = 'both' | 'onsite' | 'online';
type Reply = { summary?: AnnounceSummary; sent?: number; failed?: number; stopped?: string; message?: string };
type Run = { phase: 'idle' | 'sending' | 'done' | 'stopped'; done: number; failed: number; total: number; message?: string };

const RETRY_CHUNK = 8;
const IDLE: Run = { phase: 'idle', done: 0, failed: 0, total: 0 };
const people = (n: number) => `${n.toLocaleString('en-PH')} ${n === 1 ? 'person' : 'people'}`;

function Note({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <p className={`status ${good ? 'status-good' : 'status-warning'} announce-status`} role="status">
      {good ? <Check width={13} height={13} /> : <Alert width={13} height={13} />}
      {children}
    </p>
  );
}

/** Step 1: see the email and send a sample to one address. */
function TestSend() {
  const [to, setTo] = useState('');
  const [version, setVersion] = useState<Version>('both');
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ status: 'idle' });

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'sending' });
    try {
      const res = await fetch('/api/email/announce-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, version }),
      });
      const json = (await res.json().catch(() => ({}))) as { to?: string; sent?: string[]; message?: string };
      if (!res.ok) throw new Error(json.message || 'The test could not be sent.');
      setState({ status: 'sent', message: `Test sent to ${json.to ?? to} (${(json.sent ?? []).join(' and ').toLowerCase()})` });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'The test could not be sent.' });
    }
  }

  return (
    <>
      <h3 className="sub-head">1. See it first</h3>
      <form className="announce-form" onSubmit={sendTest}>
        <label className="filter">
          <span>Send a test to</span>
          <input type="email" name="announceTo" required autoComplete="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="filter">
          <span>Version</span>
          <select value={version} onChange={(e) => setVersion(e.target.value as Version)}>
            <option value="both">Onsite and online (2 emails)</option>
            <option value="onsite">Onsite only</option>
            <option value="online">Online only</option>
          </select>
        </label>
        <button type="submit" className="btn-mini" disabled={state.status === 'sending' || !to}>
          <Mail width={15} height={15} />
          {state.status === 'sending' ? 'Sending…' : 'Send test'}
        </button>
        <a className="btn-mini" href="/api/email/preview?notice=new-time" target="_blank" rel="noopener">
          Preview onsite
        </a>
        <a className="btn-mini" href="/api/email/preview?notice=new-time&mode=online" target="_blank" rel="noopener">
          Preview online
        </a>
      </form>
      {state.message && <Note good={state.status === 'sent'}>{state.message}</Note>}
    </>
  );
}

/** Step 2: send it to everyone who was told the old time, after confirming how many that is. */
function SendToEveryone() {
  const [summary, setSummary] = useState<AnnounceSummary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState<'all' | 'retry' | null>(null);
  const [run, setRun] = useState<Run>(IDLE);
  const stop = useRef(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch('/api/email/announce', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as Reply;
      if (!res.ok || !json.summary) throw new Error(json.message || 'Could not count the registrants.');
      setSummary(json.summary);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not count the registrants.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Closing the page mid-way only pauses it (the rest stay in line), but say so first.
  useEffect(() => {
    if (run.phase !== 'sending') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [run.phase]);

  const retryList = summary ? [...summary.failed, ...summary.unconfirmed] : [];

  async function send(which: 'all' | 'retry') {
    if (!summary) return;
    setConfirming(null);
    stop.current = false;
    const total = which === 'all' ? summary.pending : retryList.length;
    const retryIds = retryList.map((r) => r.id);
    let done = 0;
    let failed = 0;
    let left = summary.pending;
    setRun({ phase: 'sending', done, failed, total });
    try {
      for (let i = 0; which === 'all' ? left > 0 : i < retryIds.length; i += RETRY_CHUNK) {
        if (stop.current) return setRun({ phase: 'stopped', done, failed, total, message: 'Paused. The rest have not been emailed.' });
        const res = await fetch('/api/email/announce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(which === 'all' ? { confirm: 'SEND', expected: left } : { confirm: 'SEND', ids: retryIds.slice(i, i + RETRY_CHUNK) }),
        });
        const json = (await res.json().catch(() => ({}))) as Reply;
        if (json.summary) {
          setSummary(json.summary);
          left = json.summary.pending;
        }
        if (!res.ok) throw new Error(json.message || 'Sending stopped. Some may not have been emailed.');
        done += json.sent ?? 0;
        failed += json.failed ?? 0;
        setRun({ phase: 'sending', done, failed, total });
        if (json.stopped) throw new Error(json.stopped);
      }
      setRun({ phase: 'done', done, failed, total });
    } catch (e) {
      setRun({ phase: 'stopped', done, failed, total, message: e instanceof Error ? e.message : 'Sending stopped.' });
      void load();
    }
  }

  const sending = run.phase === 'sending';
  const target = confirming === 'retry' ? retryList.length : (summary?.pending ?? 0);

  return (
    <>
      <h3 className="sub-head announce-step">2. Send to everyone</h3>
      {loadError && <Note good={false}>{loadError}</Note>}
      {!summary && !loadError && <p className="muted">Counting…</p>}
      {summary && (
        <>
          <p className="announce-count">
            <b>{people(summary.pending)}</b> {summary.pending === 1 ? 'has' : 'have'} not had it yet
            {summary.pending > 0 && ` (${summary.pendingOnsite} onsite, ${summary.pendingOnline} online)`}.{' '}
            {summary.sent > 0 && `${people(summary.sent)} already ${summary.sent === 1 ? 'has' : 'have'}. `}
          </p>
          <ul className="announce-notes">
            <li>One email per address, using the latest registration{summary.merged > 0 && ` (${summary.merged} repeat ${summary.merged === 1 ? 'registration' : 'registrations'} combined)`}.</li>
            <li>
              Left out: {people(summary.alreadyToldNewTime)} who registered after the new time went live
              {summary.noEmail > 0 && `, and ${summary.noEmail} with no valid email address`}.
            </li>
          </ul>

          {!confirming && !sending && (
            <div className="announce-form">
              <button type="button" className="btn-mini btn-mini-solid" disabled={!summary.pending} onClick={() => setConfirming('all')}>
                <Mail width={15} height={15} />
                Send to {people(summary.pending)}…
              </button>
              <button type="button" className="btn-mini" onClick={() => void load()}>
                <Refresh width={15} height={15} />
                Count again
              </button>
              {retryList.length > 0 && (
                <button type="button" className="btn-mini" onClick={() => setConfirming('retry')}>
                  Try {retryList.length} again…
                </button>
              )}
            </div>
          )}

          {confirming && (
            <div className="announce-confirm" role="alertdialog" aria-label="Confirm sending">
              <p>
                <b>Email {people(target)} now?</b> They get &ldquo;New time: {EVENT.series} now starts at {EVENT.time.split(' – ')[0]}&rdquo;. Emails can&rsquo;t be
                taken back.
                {confirming === 'retry' && summary.unconfirmed.length > 0 && ' Some of these may have arrived the first time, so they could get it twice.'}
              </p>
              <div className="announce-form">
                <button type="button" className="btn-mini btn-mini-solid" onClick={() => void send(confirming)}>
                  Yes, email {people(target)}
                </button>
                <button type="button" className="btn-mini" onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sending && (
            <div className="announce-progress">
              <progress max={run.total} value={run.done + run.failed} aria-label="Emails sent" />
              <span>
                Sending… {run.done + run.failed} of {run.total}. Keep this page open.
              </span>
              <button type="button" className="btn-mini" onClick={() => (stop.current = true)}>
                Pause
              </button>
            </div>
          )}
          {run.phase === 'done' && (
            <Note good={run.failed === 0}>
              Sent to {people(run.done)}.{run.failed > 0 && ` ${run.failed} could not be sent.`}
            </Note>
          )}
          {run.phase === 'stopped' && (
            <Note good={false}>
              Sent to {people(run.done)} so far. {run.message}
            </Note>
          )}
          {summary.failed.length > 0 && <p className="muted announce-refs">Refused by the mail server: {summary.failed.map((r) => r.ref).join(', ')}</p>}
          {summary.unconfirmed.length > 0 && !sending && (
            <p className="muted announce-refs">Started but not confirmed: {summary.unconfirmed.map((r) => r.ref).join(', ')}</p>
          )}
        </>
      )}
    </>
  );
}

/** The "new time" announcement to people who registered before the time changed. */
export default function AnnouncementCard() {
  return (
    <section className="card announce-card no-print">
      <header className="card-head">
        <h2>Announcement: new time</h2>
        <p>Tells people who registered earlier that the event is now at {EVENT.time}.</p>
      </header>
      <TestSend />
      <SendToEveryone />
    </section>
  );
}
