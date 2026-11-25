'use client';

import { useEffect, useRef, useState } from 'react';
import { UPDATE_BATCH, type EmailUpdate, type UpdateContent, type UpdateSummary } from '@/lib/updates';
import { Alert, Check, Mail } from '../Icons';

type Reply = { summary?: UpdateSummary; sent?: number; failed?: number; stopped?: string; message?: string };
type Run = { phase: 'idle' | 'sending' | 'done' | 'stopped'; done: number; failed: number; total: number; message?: string };
export type Listed = EmailUpdate & { summary: UpdateSummary };

const IDLE: Run = { phase: 'idle', done: 0, failed: 0, total: 0 };
const GMAIL_DAILY = 500;
export const people = (n: number) => `${n.toLocaleString('en-PH')} ${n === 1 ? 'person' : 'people'}`;

export function Note({ good, children }: { good: boolean; children: React.ReactNode }) {
  return (
    <p className={`status ${good ? 'status-good' : 'status-warning'} upd-note`} role="status">
      {good ? <Check width={13} height={13} /> : <Alert width={13} height={13} />}
      <span>{children}</span>
    </p>
  );
}

/** See the real email in an inbox first: one sample to one typed address. */
function TestSend({ content }: { content: UpdateContent }) {
  const [to, setTo] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ status: 'idle' });
  // Onsite and online emails differ only in the boarding pass.
  const version = !content.includePass || content.audience === 'Onsite' || content.audience === 'Checked in' ? 'Onsite' : content.audience === 'Online' ? 'Online' : 'both';

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: 'sending' });
    try {
      const res = await fetch('/api/email/updates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, to, version }),
      });
      const json = (await res.json().catch(() => ({}))) as { to?: string; sent?: string[]; message?: string; errors?: Record<string, string> };
      if (!res.ok) throw new Error(Object.values(json.errors ?? {})[0] || json.message || 'The test could not be sent.');
      setState({ status: 'sent', message: `Test sent to ${json.to ?? to}${json.sent && json.sent.length > 1 ? ' (onsite and online)' : ''}.` });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'The test could not be sent.' });
    }
  }

  return (
    <div className="upd-step">
      <h3 className="sub-head">1. Test it</h3>
      <form className="upd-row" onSubmit={sendTest}>
        <input
          type="email"
          name="testTo"
          aria-label="Send a test to"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button type="submit" className="btn-mini" disabled={state.status === 'sending' || !to}>
          <Mail width={15} height={15} />
          {state.status === 'sending' ? 'Sending…' : version === 'both' ? 'Send test (2 emails)' : 'Send test'}
        </button>
      </form>
      <p className="upd-hint">Goes only to this address, with sample details.</p>
      {state.message && <Note good={state.status === 'sent'}>{state.message}</Note>}
    </div>
  );
}

export default function SendPanel({
  update,
  content,
  onSave,
  onSummary,
  onSending,
}: {
  /** The saved update, or null for a draft that was never saved. */
  update: Listed | null;
  content: UpdateContent;
  /** Saves the draft; resolves to the saved update when it is complete and can be sent. */
  onSave: () => Promise<Listed | null>;
  onSummary: (id: string, summary: UpdateSummary, started: boolean) => void;
  onSending: (sending: boolean) => void;
}) {
  const [confirming, setConfirming] = useState<{ which: 'all' | 'retry'; update: Listed; count: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [run, setRun] = useState<Run>(IDLE);
  const stop = useRef(false);
  const sending = run.phase === 'sending';

  useEffect(() => onSending(sending), [sending, onSending]);

  // Closing the page mid-way only pauses it (the rest stay in line), but say so first.
  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending]);

  // Editing again puts the confirmation away: what was confirmed is no longer what would be sent.
  useEffect(() => setConfirming(null), [content]);

  async function review(which: 'all' | 'retry') {
    setRun(IDLE);
    setChecking(true);
    const saved = !update || update.status === 'Draft' ? await onSave() : update;
    setChecking(false);
    if (!saved) return;
    const count = which === 'all' ? saved.summary.pending : saved.summary.failed.length + saved.summary.unconfirmed.length;
    if (!count) return setRun({ ...IDLE, phase: 'stopped', message: 'Nobody in this audience is left to email.' });
    setConfirming({ which, update: saved, count });
  }

  async function send({ which, update: u, count }: NonNullable<typeof confirming>) {
    setConfirming(null);
    stop.current = false;
    const retryIds = [...u.summary.failed, ...u.summary.unconfirmed].map((r) => r.id);
    let done = 0;
    let failed = 0;
    let left = u.summary.pending;
    setRun({ phase: 'sending', done, failed, total: count });
    try {
      for (let i = 0; which === 'all' ? left > 0 : i < retryIds.length; i += UPDATE_BATCH) {
        if (stop.current) return setRun({ phase: 'stopped', done, failed, total: count, message: 'Paused. The rest have not been emailed.' });
        const res = await fetch('/api/email/updates/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: u.id, confirm: 'SEND', ...(which === 'all' ? { expected: left } : { ids: retryIds.slice(i, i + UPDATE_BATCH) }) }),
        });
        const json = (await res.json().catch(() => ({}))) as Reply;
        if (json.summary) {
          left = json.summary.pending;
          onSummary(u.id, json.summary, res.ok);
        }
        if (!res.ok) throw new Error(json.message || 'Sending stopped. Some may not have been emailed.');
        done += json.sent ?? 0;
        failed += json.failed ?? 0;
        setRun({ phase: 'sending', done, failed, total: count });
        if (json.stopped) throw new Error(json.stopped);
      }
      setRun({ phase: 'done', done, failed, total: count });
    } catch (e) {
      setRun({ phase: 'stopped', done, failed, total: count, message: e instanceof Error ? e.message : 'Sending stopped.' });
    }
  }

  const s = update?.summary;
  const started = Boolean(update && update.status !== 'Draft');
  const retry = s ? s.failed.length + s.unconfirmed.length : 0;

  return (
    <section className="card upd-send">
      <TestSend content={content} />

      <div className="upd-step">
        <h3 className="sub-head">2. Send it</h3>
        {started && s && (
          <p className="upd-sent">
            <b>{people(s.sent)}</b> {s.sent === 1 ? 'has' : 'have'} had this update.
            {s.pending > 0 && ` ${people(s.pending)} in this audience ${s.pending === 1 ? 'has' : 'have'} not (for example, newer registrants).`}
          </p>
        )}
        {!confirming && !sending && (
          <div className="upd-row">
            <button type="button" className="btn-mini btn-mini-solid" disabled={checking || (started && !s?.pending)} onClick={() => void review('all')}>
              <Mail width={15} height={15} />
              {checking ? 'Checking…' : started ? `Send to ${people(s?.pending ?? 0)} more…` : 'Review and send…'}
            </button>
            {retry > 0 && (
              <button type="button" className="btn-mini" onClick={() => void review('retry')}>
                Try {retry} again…
              </button>
            )}
          </div>
        )}
        {!started && !confirming && !sending && <p className="upd-hint">Saves the draft and shows how many people would get it. Nothing is sent until you confirm.</p>}

        {confirming && (
          <div className="upd-confirm" role="alertdialog" aria-label="Confirm sending">
            <p className="upd-confirm-q">Email {people(confirming.count)} now?</p>
            <dl>
              <div>
                <dt>Subject</dt>
                <dd>{confirming.update.subject}</dd>
              </div>
              <div>
                <dt>Send to</dt>
                <dd>
                  {confirming.update.audience}
                  {confirming.which === 'all' && ` (${confirming.update.summary.pendingOnsite} onsite, ${confirming.update.summary.pendingOnline} online)`}
                  {confirming.which === 'retry' && ', only those that did not go through'}
                </dd>
              </div>
              <div>
                <dt>Includes</dt>
                <dd>
                  {[confirming.update.includePass && 'boarding pass', confirming.update.attachInvite && 'calendar invite'].filter(Boolean).join(' and ') ||
                    'just the message'}
                </dd>
              </div>
            </dl>
            <p>
              One email per address. Emails can&rsquo;t be taken back.
              {confirming.which === 'retry' && confirming.update.summary.unconfirmed.length > 0 && ' Some of these may have arrived the first time, so they could get it twice.'}
              {confirming.count > GMAIL_DAILY - 50 && ' Gmail allows about 500 emails a day; if it runs out, the rest wait and you can continue tomorrow.'}
            </p>
            <div className="upd-row">
              <button type="button" className="btn-mini btn-mini-solid" onClick={() => void send(confirming)}>
                Yes, email {people(confirming.count)}
              </button>
              <button type="button" className="btn-mini" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {sending && (
          <div className="upd-progress">
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
            {run.total > 0 && `Sent to ${people(run.done)} so far. `}
            {run.message}
          </Note>
        )}
        {s && s.failed.length > 0 && <p className="upd-hint">Refused by the mail server: {s.failed.map((r) => r.ref).join(', ')}</p>}
        {s && s.unconfirmed.length > 0 && !sending && <p className="upd-hint">Started but not confirmed: {s.unconfirmed.map((r) => r.ref).join(', ')}</p>}
      </div>
    </section>
  );
}
