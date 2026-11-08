'use client';

import Image from 'next/image';
import { useState } from 'react';
import { EVENT } from '@/lib/config';
import { Alert, ArrowRight, Lock } from '../Icons';

export default function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Sign-in failed.');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <section className="form-card login-card">
      <div className="login-logos">
        <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority />
        <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority />
      </div>
      <p className="form-kicker">Mission control</p>
      <h1 className="login-title">{EVENT.title}</h1>
      <p className="login-lead">
        Registration dashboard for the {EVENT.series}. For the TM241 organizing team only — sign in to view and export
        registrations.
      </p>

      {configured ? (
        <form onSubmit={submit} noValidate>
          <div className={`field${error ? ' has-error' : ''}`}>
            <label htmlFor="dash-password" className="label">
              Dashboard password
            </label>
            <div className="control with-icon">
              <span className="control-icon">
                <Lock />
              </span>
              <input
                id="dash-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'dash-password-err' : undefined}
                autoFocus
              />
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
