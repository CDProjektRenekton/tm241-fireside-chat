'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import { Alert, ArrowLeft, Check, Refresh, ScanQr, Search, Video } from '../Icons';

interface Person {
  id: string;
  ref: string;
  name: string;
  organization: string;
  affiliation: string;
  mode: 'Onsite' | 'Online';
  attended: boolean;
  checkedInAt: string;
}

type Show = 'all' | 'in' | 'out';

const REFRESH_MS = 10_000;
/** How long a new arrival stays highlighted. */
const FRESH_MS = 60_000;

const clock = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const clockSec = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const time = (iso: string) => (iso ? clock.format(new Date(iso)) : '');
const n = (v: number) => v.toLocaleString('en-PH');
const byArrival = (a: Person, b: Person) => Date.parse(b.checkedInAt || '0') - Date.parse(a.checkedInAt || '0');
const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/** Who has arrived, newest first, refreshed by itself. Read-only: checking in happens at the desk. */
export default function ArrivalsBoard() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState('');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState<Show>('all');
  const [mode, setMode] = useState<'' | 'Onsite' | 'Online'>('');
  const [query, setQuery] = useState('');
  // ids checked in since this page opened, with when we first saw them, so they stand out for a minute
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const seen = useRef<Set<string> | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkin/arrivals', { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      const json = (await res.json().catch(() => ({}))) as { people?: Person[]; fetchedAt?: string; message?: string };
      if (!res.ok || !json.people) throw new Error(json.message || 'Could not refresh.');
      const now = Date.now();
      const arrived = json.people.filter((p) => p.attended).map((p) => p.id);
      if (seen.current) {
        const newcomers = arrived.filter((id) => !seen.current!.has(id));
        if (newcomers.length) setFresh((f) => ({ ...f, ...Object.fromEntries(newcomers.map((id) => [id, now])) }));
      }
      seen.current = new Set(arrived);
      setPeople(json.people);
      setFetchedAt(json.fetchedAt ?? new Date().toISOString());
      setProblem('');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
      tick((t) => t + 1); // lets highlights fade on time
    }, REFRESH_MS);
    const back = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', back);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', back);
    };
  }, [load]);

  const all = useMemo(() => people ?? [], [people]);
  const inCount = all.filter((p) => p.attended).length;
  const onsite = all.filter((p) => p.mode === 'Onsite');
  const onsiteIn = onsite.filter((p) => p.attended).length;
  const onlineIn = all.filter((p) => p.mode === 'Online' && p.attended).length;
  const latest = all.filter((p) => p.attended && p.checkedInAt).sort(byArrival)[0];
  const share = onsite.length ? Math.round((onsiteIn / onsite.length) * 100) : 0;

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = all
    .filter((p) => (show === 'in' ? p.attended : show === 'out' ? !p.attended : true))
    .filter((p) => !mode || p.mode === mode)
    .filter((p) => {
      if (!words.length) return true;
      const hay = `${p.name} ${p.organization} ${p.affiliation} ${p.ref}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  // arrivals first, newest at the top; then everyone not here yet, A to Z
  const shown = [...list.filter((p) => p.attended).sort(byArrival), ...list.filter((p) => !p.attended).sort(byName)];
  const now = Date.now();

  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-head-inner">
          <div className="dash-brand">
            <div className="dash-logos">
              <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority />
              <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority />
            </div>
            <div>
              <p className="dash-kicker">{EVENT.series} · Arrivals</p>
              <h1>{EVENT.title}</h1>
              <p className="dash-sub">Who has been checked in at the door. This page updates by itself every {REFRESH_MS / 1000} seconds.</p>
            </div>
          </div>
          <div className="dash-actions">
            <span className={`arr-live${problem ? ' is-off' : ''}`} role="status">
              <i aria-hidden="true" />
              {problem ? 'Not updating' : fetchedAt ? `Live · ${clockSec.format(new Date(fetchedAt))}` : 'Loading…'}
            </span>
            <a className="head-btn" href="/dashboard">
              <ArrowLeft width={18} height={18} />
              Dashboard
            </a>
            <a className="head-btn" href="/checkin">
              <ScanQr width={18} height={18} />
              Check-in desk
            </a>
            <button type="button" className="head-btn" onClick={() => void load()} disabled={loading}>
              <Refresh className={loading ? 'spin' : ''} width={18} height={18} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        {problem && (
          <p className="banner banner-error" role="alert">
            <Alert />
            <span>
              {problem} {people ? 'Showing the last list; it will try again by itself.' : ''}
            </span>
          </p>
        )}

        {people && (
          <>
            <section className="arr-kpis" aria-label="Totals">
              <div className="tile tile-hero">
                <p className="tile-label">Checked in</p>
                <p className="tile-value">
                  {n(inCount)}
                  <span className="arr-of"> / {n(all.length)}</span>
                </p>
                <span className="arr-bar" aria-hidden="true">
                  <span style={{ width: `${all.length ? (inCount / all.length) * 100 : 0}%` }} />
                </span>
                <p className="tile-note">of everyone who registered</p>
              </div>
              <div className="tile">
                <p className="tile-label">Onsite registrants here</p>
                <p className="tile-value">
                  {n(onsiteIn)}
                  <span className="arr-of"> / {n(onsite.length)}</span>
                </p>
                <p className="tile-note">{share}% of onsite registrants</p>
              </div>
              <div className="tile">
                <p className="tile-label">Not here yet</p>
                <p className="tile-value">{n(all.length - inCount)}</p>
                <p className="tile-note">{n(onsite.length - onsiteIn)} of them registered onsite</p>
              </div>
              <div className="tile">
                <p className="tile-label">Latest arrival</p>
                <p className="tile-value arr-latest">{latest ? time(latest.checkedInAt) : '—'}</p>
                <p className="tile-note">{latest ? latest.name : 'Nobody checked in yet'}</p>
              </div>
            </section>
            {onlineIn > 0 && (
              <p className="arr-aside">
                <Video width={14} height={14} /> {n(onlineIn)} who registered online came in person and {onlineIn === 1 ? 'was' : 'were'} checked in.
              </p>
            )}

            <section className="card arr-card">
              <div className="arr-tools">
                <div className="arr-seg" role="group" aria-label="Show">
                  {(
                    [
                      ['all', `All ${n(all.length)}`],
                      ['in', `Checked in ${n(inCount)}`],
                      ['out', `Not yet ${n(all.length - inCount)}`],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="arr-seg" role="group" aria-label="How they registered">
                  {(
                    [
                      ['', 'Onsite and online'],
                      ['Onsite', 'Onsite'],
                      ['Online', 'Online'],
                    ] as const
                  ).map(([v, label]) => (
                    <button key={v || 'both'} type="button" aria-pressed={mode === v} onClick={() => setMode(v)}>
                      {label}
                    </button>
                  ))}
                </div>
                <span className="search-box arr-search">
                  <Search width={16} height={16} />
                  <input type="search" placeholder="Name, organization or reference" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
                </span>
              </div>

              <p className="arr-count" aria-live="polite">
                {shown.length === all.length ? `${n(shown.length)} people` : `${n(shown.length)} of ${n(all.length)} people`}
              </p>
              {shown.length === 0 ? (
                <p className="muted arr-empty">{all.length ? 'Nobody matches.' : 'Nobody has registered yet.'}</p>
              ) : (
                <ol className="arr-list">
                  {shown.map((p) => {
                    const isFresh = Boolean(fresh[p.id] && now - fresh[p.id] < FRESH_MS);
                    return (
                      <li key={p.id} className={`${p.attended ? 'is-in' : 'is-out'}${isFresh ? ' is-fresh' : ''}`}>
                        <span className="arr-state">
                          {p.attended ? (
                            <>
                              <Check width={14} height={14} />
                              {time(p.checkedInAt) || 'In'}
                            </>
                          ) : (
                            'Not yet'
                          )}
                        </span>
                        <span className="arr-who">
                          <strong>{p.name || '—'}</strong>
                          <span className="cell-sub">{[p.organization, p.affiliation].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="arr-meta">
                          {isFresh && <span className="status status-good">Just arrived</span>}
                          {p.mode === 'Online' && (
                            <span className="status status-online">
                              <Video width={12} height={12} /> Online
                            </span>
                          )}
                          <span className="mono arr-ref">{p.ref}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
