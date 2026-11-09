'use client';

import Image from 'next/image';
import { useState } from 'react';
import { EVENT } from '@/lib/config';
import CardSweep from '../CardSweep';
import { Alert, ArrowRight, Eye, EyeOff, Lock } from '../Icons';

const COPY = {
  dashboard: {
    kicker: 'Mission control',
    lead: (series: string) =>
      `Registration dashboard for the ${series}.`,
    label: 'Dashboard password',
  },
  checkin: {
    kicker: 'Check-in desk',
    lead: (series: string) =>
      `Ticket scanner for the ${series}.`,
    label: 'Desk password',
  },
};

export default function LoginForm({ configured, area = 'dashboard' }: { configured: boolean; area?: 'dashboard' | 'checkin' }) {
  const copy = COPY[area];
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    // Hide it again while signing in, so it isn't left on screen at a shared desk.
    setShown(false);
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, area }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Sign-in failed.');
      if (json.next) window.location.assign(json.next);
      else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <section className="form-card login-card">
      <CardSweep />
      <div className="login-logos">
        <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority />
        <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority />
      </div>
      <p className="form-kicker">{copy.kicker}</p>
      <h1 className="login-title">{EVENT.title}</h1>
      <p className="login-lead">{copy.lead(EVENT.series)}</p>

      {configured ? (
        <form onSubmit={submit} noValidate>
          <div className={`field${error ? ' has-error' : ''}`}>
            <label htmlFor="dash-password" className="label">
              {copy.label}
            </label>
            <div className="control with-icon">
              <span className="control-icon">
                <Lock />
              </span>
              <input
                id="dash-password"
                type={shown ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'dash-password-err' : undefined}
                autoFocus
              />
              <button
                type="button"
                className="reveal-btn"
                onClick={() => setShown((v) => !v)}
                // keep the cursor in the password field when the eye is clicked or tapped
                onMouseDown={(e) => e.preventDefault()}
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
                aria-controls="dash-password"
                title={shown ? 'Hide password' : 'Show password'}
              >
                {shown ? <EyeOff /> : <Eye />}
              </button>
              <span className="control-glow" aria-hidden="true" />
            </div>
            {error && (
              <p className="field-error" id="dash-password-err" role="alert">
                <Alert width={16} height={16} />
                {error}
              </p>
            )}
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={busy || !password}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {busy ? 'Signing in…' : 'Sign in'}
            {!busy && <ArrowRight />}
          </button>
        </form>
      ) : (
        <p className="callout callout-warn">
          <Alert />
          <span>
            The dashboard is not set up yet.
            <small>Add a DASHBOARD_PASSWORD environment variable in Vercel (Project → Settings → Environment Variables), then redeploy.</small>
          </span>
        </p>
      )}
      <p className="login-back">
        <a href="/">← Back to the registration form</a>
      </p>
    </section>
  );
}
