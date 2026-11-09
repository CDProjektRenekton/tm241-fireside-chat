'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import { parseRef } from '@/lib/ticket';
import type { CheckInResult, DeskRecord } from '@/lib/types';
import { Alert, Check, ClipboardList, Info, LogOut, Search, X } from '../Icons';
import Scanner, { type Flash } from './Scanner';

type Mode = 'checkin' | 'verify';
type Outcome = CheckInResult | 'error';

interface Result {
  kind: Outcome;
  ref?: string | null;
  record?: DeskRecord;
  message?: string;
  at: number;
}

interface HistoryItem {
  key: number;
  kind: Outcome;
  ref: string;
  name: string;
}

const REPEAT_MS = 4000; // ignore the same code while it is still in front of the camera
const COUNT_REFRESH_MS = 30_000;
const HISTORY_KEY = 'tm241-fc-desk-history';

const timeFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const time = (iso: string) => (iso ? timeFmt.format(new Date(iso)) : '');
const fmt = (n: number) => n.toLocaleString('en-PH');

const FLASH: Record<Outcome, Flash> = {
  'checked-in': 'ok',
  valid: 'ok',
  undone: 'warn',
  already: 'warn',
  'not-found': 'bad',
  invalid: 'bad',
  error: 'bad',
};

// ---------------------------------------------------------------- feedback (sound + vibration)

let audio: AudioContext | null = null;
function feedback(kind: Flash, sound: boolean) {
  const pattern = kind === 'ok' ? [40] : kind === 'warn' ? [70, 60, 70] : [220];
  // Browsers only allow vibration (and sound) after someone has touched the page.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  navigator.vibrate?.(pattern);
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    const tones = kind === 'ok' ? [880, 1320] : kind === 'warn' ? [620, 620] : [196];
    tones.forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      const t = audio!.currentTime + i * 0.14;
      const len = kind === 'bad' ? 0.42 : 0.11;
      o.type = kind === 'bad' ? 'square' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === 'bad' ? 0.08 : 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(audio!.destination);
      o.start(t);
      o.stop(t + len + 0.02);
    });
  } catch {
    /* no audio on this device */
  }
}

// ---------------------------------------------------------------- result card

function ResultCard({
  result,
  mode,
  busy,
  onUndo,
  onCheckIn,
}: {
  result: Result | null;
  mode: Mode;
  busy: boolean;
  onUndo: (r: DeskRecord) => void;
  onCheckIn: (r: DeskRecord) => void;
}) {
  if (!result) {
    return (
      <div className="result result-idle">
        <span className="result-icon">
          <Info />
        </span>
        <div>
          <p className="result-title">Ready</p>
          <p className="result-note">
            {mode === 'checkin'
              ? 'Scan a boarding pass. Genuine tickets are checked against the registration database and marked “Attended”.'
              : 'Verify only: scanning checks a ticket against the database without marking attendance.'}
          </p>
        </div>
      </div>
    );
  }

  const r = result.record;
  const copy: Record<Outcome, { tone: string; title: string; note: string }> = {
    'checked-in': { tone: 'ok', title: 'Checked in', note: `Genuine ticket · marked “Attended” at ${time(r?.checkedInAt ?? '')}` },
    valid: { tone: 'ok', title: 'Genuine ticket', note: 'Registered and not checked in yet.' },
    already: {
      tone: 'warn',
      title: 'Already checked in',
      note: `This ticket was scanned at ${time(r?.checkedInAt ?? '') || 'an earlier time'}. If this isn’t the same person, check their ID.`,
    },
    undone: { tone: 'neutral', title: 'Check-in undone', note: '“Attended” was cleared for this registrant.' },
    'not-found': {
      tone: 'bad',
      title: 'Not registered',
      note: `No registration has the reference number ${result.ref}. The ticket may be fake or mistyped — try typing it, or search by name.`,
    },
    invalid: { tone: 'bad', title: 'Not a Fireside Chat ticket', note: 'This code does not contain a TM241-FC reference number.' },
    error: { tone: 'bad', title: 'Couldn’t check this ticket', note: result.message ?? 'Please try again.' },
  };
  const c = copy[result.kind];
  const Icon = c.tone === 'ok' ? Check : c.tone === 'bad' ? X : c.tone === 'warn' ? Alert : Info;

  return (
    <div className={`result result-${c.tone}`} key={result.at}>
      <span className="result-icon">
        <Icon />
      </span>
      <div className="result-body">
        <p className="result-title">{c.title}</p>
        {r && (
          <>
            <p className="result-name">{r.name || 'No name on record'}</p>
            <p className="result-org">
              {r.organization}
              {r.affiliation && <em>{r.affiliation}</em>}
            </p>
            <p className="result-ref mono">{r.ref}</p>
          </>
        )}
        <p className="result-note">{c.note}</p>
        {r && (
          <div className="result-actions">
            {(result.kind === 'checked-in' || result.kind === 'already') && (
              <button type="button" className="btn-mini" disabled={busy} onClick={() => onUndo(r)}>
                Undo check-in
              </button>
            )}
            {(result.kind === 'valid' || result.kind === 'undone') && (
              <button type="button" className="btn-mini btn-mini-solid" disabled={busy} onClick={() => onCheckIn(r)}>
                <Check width={16} height={16} />
                Check in now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- desk

export default function CheckInDesk({ isAdmin }: { isAdmin: boolean }) {
  const [mode, setMode] = useState<Mode>('checkin');
  const [counts, setCounts] = useState<{ total: number; attended: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DeskRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sound, setSound] = useState(true);
  const [loadError, setLoadError] = useState('');
  const last = useRef({ text: '', at: 0 });
  const busyRef = useRef(false);
  const modeRef = useRef<Mode>('checkin');
  const soundRef = useRef(true);

  useEffect(() => {
    modeRef.current = mode;
    // Switching between "Verify only" and "Check in" re-reads a ticket that is still in front of the camera.
    last.current = { text: '', at: 0 };
  }, [mode]);
  useEffect(() => {
    soundRef.current = sound;
    try {
      localStorage.setItem('tm241-fc-desk-sound', sound ? '1' : '0');
    } catch {
      /* storage blocked */
    }
  }, [sound]);

  // Restore this tab's recent scans and the sound setting.
  useEffect(() => {
    try {
      const h = sessionStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryItem[]);
      if (localStorage.getItem('tm241-fc-desk-sound') === '0') setSound(false);
    } catch {
      /* storage blocked */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* storage blocked */
    }
  }, [history]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/checkin', { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setCounts({ total: json.total, attended: json.attended });
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error && e.message ? e.message : 'Could not reach the registration database.');
    }
  }, []);

  useEffect(() => {
    void loadCounts();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadCounts();
    }, COUNT_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadCounts]);

  const submit = useCallback(async (body: { code?: string; id?: string; action: Mode | 'undo' }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let outcome: Result;
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const json = await res.json().catch(() => ({}));
      outcome = res.ok
        ? { kind: json.result as CheckInResult, ref: json.ref, record: json.record, at: Date.now() }
        : { kind: 'error', message: json.message, at: Date.now() };
    } catch {
      outcome = { kind: 'error', message: 'No connection. Check the Wi-Fi or mobile data and scan again.', at: Date.now() };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }

    setResult(outcome);
    feedback(FLASH[outcome.kind], soundRef.current);
    if (outcome.kind === 'checked-in') setCounts((c) => (c ? { ...c, attended: c.attended + 1 } : c));
    if (outcome.kind === 'undone') setCounts((c) => (c ? { ...c, attended: Math.max(0, c.attended - 1) } : c));
    if (outcome.record) {
      const rec = outcome.record;
      setMatches((m) => m?.map((x) => (x.id === rec.id ? { ...x, attended: rec.attended, checkedInAt: rec.checkedInAt } : x)) ?? m);
    }
    if (outcome.kind !== 'error') {
      setHistory((h) =>
        [
          {
            key: outcome.at,
            kind: outcome.kind,
            ref: outcome.record?.ref || outcome.ref || '—',
            name: outcome.record?.name || '',
          },
          ...h,
        ].slice(0, 30),
      );
    }
  }, []);

  const onDetect = useCallback(
    (text: string) => {
      const now = Date.now();
      if (busyRef.current) return;
      if (text === last.current.text && now - last.current.at < REPEAT_MS) {
        last.current.at = now; // still in front of the camera
        return;
      }
      last.current = { text, at: now };
      void submit({ code: text, action: modeRef.current });
    },
    [submit],
  );

  function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    if (!parseRef(typed)) {
      setResult({ kind: 'invalid', at: Date.now() });
      feedback('bad', soundRef.current);
      return;
    }
    void submit({ code: typed, action: mode });
    setTyped('');
  }

  // Name / email search for registrants without their ticket.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMatches(null);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/checkin?q=${encodeURIComponent(q)}`, { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json();
        if (res.ok) {
          setMatches(json.matches ?? []);
          setCounts({ total: json.total, attended: json.attended });
        }
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  const percent = counts && counts.total ? Math.round((counts.attended / counts.total) * 100) : 0;
  const flash = result ? FLASH[result.kind] : null;

  return (
    <div className="desk">
      <header className="desk-head">
        <div className="desk-brand">
          <div className="dash-logos">
            <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority />
            <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority />
          </div>
          <div className="desk-titles">
            <p className="dash-kicker">
              <span className="desk-series">{EVENT.series} · </span>Check-in desk
            </p>
            <h1>{EVENT.title}</h1>
          </div>
        </div>
        <div className="desk-count" role="status" aria-live="polite">
          <span className="desk-count-ring" style={{ '--p': `${percent}%` } as React.CSSProperties} aria-hidden="true" />
          <span>
            <strong>{counts ? fmt(counts.attended) : '–'}</strong>
            <span className="desk-count-of"> / {counts ? fmt(counts.total) : '–'}</span>
            <small>checked in</small>
          </span>
        </div>
        <div className="desk-actions">
          {isAdmin && (
            <a className="head-btn" href="/dashboard">
              <ClipboardList width={18} height={18} />
              Dashboard
            </a>
          )}
          <button type="button" className="head-btn" onClick={() => void logout()}>
            <LogOut width={18} height={18} />
            Sign out
          </button>
        </div>
      </header>

      <main className="desk-main">
        {loadError && (
          <p className="banner banner-error desk-banner" role="alert">
            <Alert />
            <span>{loadError}</span>
            <button type="button" className="btn-mini" onClick={() => void loadCounts()}>
              Try again
            </button>
          </p>
        )}

        {/* On phones these two wrappers dissolve so the result card sits right under the camera. */}
        <div className="desk-left">
        <section className="card desk-scan" aria-label="Scan tickets">
          <div className="desk-toolbar">
            <div className="seg" role="group" aria-label="What scanning does">
              <button type="button" aria-pressed={mode === 'checkin'} onClick={() => setMode('checkin')}>
                Check in
              </button>
              <button type="button" aria-pressed={mode === 'verify'} onClick={() => setMode('verify')}>
                Verify only
              </button>
            </div>
            <label className="sound-toggle">
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
              Sound
            </label>
          </div>

          <Scanner onDetect={onDetect} flash={flash} flashKey={result?.at ?? 0} />
        </section>

          <form className="card typed" onSubmit={submitTyped}>
            <label htmlFor="typed-ref">No QR code? Type the reference number</label>
            <div className="typed-row">
              <span className="typed-control">
                <span className="typed-prefix mono">{EVENT.refPrefix}-</span>
                <input
                  id="typed-ref"
                  className="mono"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.toUpperCase())}
                  placeholder="7KQ2MX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={24}
                  enterKeyHint="go"
                />
              </span>
              <button type="submit" className="btn-mini btn-mini-solid" disabled={busy || !typed.trim()}>
                {mode === 'checkin' ? 'Check in' : 'Verify'}
              </button>
            </div>
          </form>
        </div>

        <div className="desk-side">
          <section className={`desk-result${busy ? ' is-busy' : ''}`} aria-live="assertive" aria-label="Last scan">
            {busy && (
              <p className="desk-checking">
                <span className="spinner" aria-hidden="true" /> Checking the database…
              </p>
            )}
            <ResultCard
              result={result}
              mode={mode}
              busy={busy}
              onUndo={(r) => void submit({ id: r.id, action: 'undo' })}
              onCheckIn={(r) => void submit({ id: r.id, action: 'checkin' })}
            />
          </section>

          <section className="card desk-search">
            <header className="card-head">
              <h2>Lost ticket?</h2>
              <p>Find the registrant by name, email or organization.</p>
            </header>
            <span className="search-box">
              <Search width={16} height={16} />
              <input type="search" placeholder="e.g. Dela Cruz" value={query} onChange={(e) => setQuery(e.target.value)} />
            </span>
            {matches && (
              <ul className="matches">
                {matches.length === 0 && !searching && <li className="muted">No registrant matches “{query.trim()}”.</li>}
                {matches.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{m.name || '—'}</strong>
                      <span className="cell-sub">
                        {[m.organization, m.email, m.ref].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    {m.attended ? (
                      <span className="status status-good">
                        <Check width={13} height={13} /> In at {time(m.checkedInAt)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-mini"
                        disabled={busy}
                        onClick={() => void submit({ id: m.id, action: mode })}
                      >
                        {mode === 'checkin' ? 'Check in' : 'Verify'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card desk-history">
            <header className="card-head">
              <h2>Recent scans</h2>
            </header>
            {history.length === 0 ? (
              <p className="muted desk-empty">Nothing scanned yet.</p>
            ) : (
              <ol className="history">
                {history.map((h) => (
                  <li key={h.key} className={`h-${FLASH[h.kind]}`}>
                    <span className="h-dot" aria-hidden="true" />
                    <span className="h-main">
                      <strong>{h.name || h.ref}</strong>
                      <span className="cell-sub">
                        {h.name ? `${h.ref} · ` : ''}
                        {
                          {
                            'checked-in': 'Checked in',
                            valid: 'Genuine (verified)',
                            already: 'Already checked in',
                            undone: 'Check-in undone',
                            'not-found': 'Not registered',
                            invalid: 'Not a ticket',
                            error: 'Error',
                          }[h.kind]
                        }
                      </span>
                    </span>
                    <time className="h-time">{timeFmt.format(new Date(h.key))}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
