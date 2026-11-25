'use client';

import { useState } from 'react';
import { EVENT } from '@/lib/config';
import { Alert, Check, Mail } from '../Icons';

type Version = 'both' | 'onsite' | 'online';

/** The "new time" announcement: see it, and send a sample to one address before anyone else gets it. */
export default function AnnouncementCard() {
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
    <section className="card announce-card no-print">
      <header className="card-head">
        <h2>Announcement: new time</h2>
        <p>
          Tells registrants the event is now at {EVENT.time}. Look at it here, or send a sample to one address. Nothing on this
          card emails registrants.
        </p>
      </header>
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
        <button type="submit" className="btn-mini btn-mini-solid" disabled={state.status === 'sending' || !to}>
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
      {state.message && (
        <p className={`status ${state.status === 'sent' ? 'status-good' : 'status-warning'} announce-status`} role="status">
          {state.status === 'sent' ? <Check width={13} height={13} /> : <Alert width={13} height={13} />}
          {state.message}
        </p>
      )}
    </section>
  );
}
