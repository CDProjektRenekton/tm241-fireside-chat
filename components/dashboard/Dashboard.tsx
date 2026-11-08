'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { AFFILIATIONS, EVENT, TOPIC_SHORT, TOPICS, type Topic } from '@/lib/config';
import {
  applyFilters,
  computeStats,
  describeFilters,
  EMPTY_FILTERS,
  filtersToParams,
  findDuplicates,
  formatDateTime,
  RANGE_LABELS,
  type Filters,
  type RangeKey,
} from '@/lib/stats';
import type { Registration, SchemaStatus } from '@/lib/types';
import {
  Alert,
  Check,
  ClipboardList,
  Copy,
  Database,
  FileText,
  LogOut,
  Message,
  Printer,
  Refresh,
  ScanQr,
  Search,
  Sheet,
} from '../Icons';
import { BarList, ColumnChart, DailyTable, pct, StatTile } from './Charts';
import QuestionWall from './QuestionWall';
import ResponsesTable from './ResponsesTable';

interface Payload {
  records: Registration[];
  schema: SchemaStatus;
  fetchedAt: string;
}

const REFRESH_MS = 60_000;
const fmt = (n: number) => n.toLocaleString('en-PH');
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

export default function Dashboard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [setup, setSetup] = useState<{ busy: boolean; message: string; ok?: boolean }>({ busy: false, message: '' });
  const [printing, setPrinting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/responses', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not load responses.');
      setPayload(json as Payload);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load responses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Print every filtered row, not just the current table page.
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const records = useMemo(() => payload?.records ?? [], [payload]);
  const filtered = useMemo(() => applyFilters(records, filters), [records, filters]);
  const stats = useMemo(() => computeStats(filtered), [filtered]);
  const dupKeys = useMemo(() => findDuplicates(records), [records]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const toggleFilter = (key: 'affiliation' | 'topic', value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key] === value ? '' : value }));
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  const exportHref = (format: string) => {
    const p = filtersToParams(filters);
    p.set('format', format);
    return `/api/export?${p}`;
  };

  async function runSetup() {
    setSetup({ busy: true, message: '' });
    try {
      const res = await fetch('/api/admin/setup', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || 'Setup failed.');
      const r = json.report as { createdFields: string[]; tableName: string; createdTable: boolean };
      setSetup({
        busy: false,
        ok: true,
        message: r.createdTable
          ? `Created table “${r.tableName}” with ${r.createdFields.length} fields.`
          : `Added ${r.createdFields.length} field(s) to “${r.tableName}”.`,
      });
      await load();
    } catch (e) {
      setSetup({ busy: false, ok: false, message: e instanceof Error ? e.message : 'Setup failed.' });
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  async function copyFormLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      /* clipboard blocked */
    }
  }

  const topTopic = stats.byTopic.find((t) => t.count > 0);

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
              <p className="dash-kicker">{EVENT.series} · Registration dashboard</p>
              <h1>{EVENT.title}</h1>
              <p className="dash-sub">
                {EVENT.dateEn} · {EVENT.time} · {EVENT.venue}, UP Diliman
              </p>
            </div>
          </div>
          <div className="dash-actions no-print">
            {payload && <span className="dash-updated">Updated {formatDateTime(payload.fetchedAt)}</span>}
            <a className="head-btn" href="/checkin">
              <ScanQr width={18} height={18} />
              Check-in desk
            </a>
            <button type="button" className="head-btn" onClick={() => void copyFormLink()}>
              {linkCopied ? <Check width={18} height={18} /> : <Copy width={18} height={18} />}
              {linkCopied ? 'Link copied' : 'Copy form link'}
            </button>
            <button type="button" className="head-btn" onClick={() => void load()} disabled={loading}>
              <Refresh className={loading ? 'spin' : ''} width={18} height={18} />
              Refresh
            </button>
            <button type="button" className="head-btn" onClick={() => void logout()}>
              <LogOut width={18} height={18} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className={`dash-main${loading && payload ? ' is-refreshing' : ''}`}>
        {error && (
          <p className="banner banner-error" role="alert">
            <Alert />
            <span>{error}</span>
            <button type="button" className="btn-mini" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}

        {payload && !payload.schema.ok && (
          <div className="banner banner-warn" role="status">
            <Database />
            <div>
              <strong>Airtable needs setup.</strong> {payload.schema.missing.length} field(s) are missing
              {payload.schema.tableName ? ` in “${payload.schema.tableName}”` : ' (the table was not found)'}:{' '}
              <span className="muted">
                {payload.schema.missing.slice(0, 6).join(', ')}
                {payload.schema.missing.length > 6 ? '…' : ''}
              </span>
            </div>
            <button type="button" className="btn-mini btn-mini-solid" onClick={() => void runSetup()} disabled={setup.busy}>
              {setup.busy ? 'Creating…' : 'Create fields now'}
            </button>
          </div>
        )}
        {setup.message && (
          <p className={`banner ${setup.ok ? 'banner-ok' : 'banner-error'}`} role="status">
            {setup.message}
          </p>
        )}

        <section className="toolbar no-print" aria-label="Filters and export">
          <div className="filters">
            <label className="filter">
              <span>Submitted</span>
              <select value={filters.range} onChange={(e) => setFilter('range', e.target.value as RangeKey)}>
                {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                  <option key={k} value={k}>
                    {RANGE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter filter-search">
              <span>Search</span>
              <span className="search-box">
                <Search width={16} height={16} />
                <input
                  type="search"
                  placeholder="Name, email, organization, question…"
                  value={filters.q}
                  onChange={(e) => setFilter('q', e.target.value)}
                />
              </span>
            </label>
            <label className="filter">
              <span>Affiliation</span>
              <select value={filters.affiliation} onChange={(e) => setFilter('affiliation', e.target.value)}>
                <option value="">All affiliations</option>
                {AFFILIATIONS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="filter">
              <span>Topic</span>
              <select value={filters.topic} onChange={(e) => setFilter('topic', e.target.value)}>
                <option value="">All topics</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_SHORT[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter">
              <span>Speaker question</span>
              <select value={filters.question} onChange={(e) => setFilter('question', e.target.value as Filters['question'])}>
                <option value="">Everyone</option>
                <option value="yes">Asked a question</option>
                <option value="no">No question</option>
              </select>
            </label>
            <label className="filter">
              <span>Attendance</span>
              <select value={filters.attended} onChange={(e) => setFilter('attended', e.target.value as Filters['attended'])}>
                <option value="">Everyone</option>
                <option value="yes">Checked in</option>
                <option value="no">Not checked in</option>
              </select>
            </label>
            {hasFilters && (
              <button type="button" className="btn-mini filter-reset" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>
          <div className="exports">
            <span className="exports-label">Export</span>
            <a className="btn-mini" href={exportHref('xlsx')} download>
              <Sheet width={16} height={16} />
              Excel
            </a>
            <a className="btn-mini" href={exportHref('csv')} download>
              <FileText width={16} height={16} />
              CSV
            </a>
            <a className="btn-mini" href={exportHref('attendance-csv')} download>
              <ClipboardList width={16} height={16} />
              Attendance sheet
            </a>
            <a className="btn-mini" href={exportHref('questions-csv')} download>
              <Message width={16} height={16} />
              Speaker questions
            </a>
            <button type="button" className="btn-mini" onClick={() => window.print()}>
              <Printer width={16} height={16} />
              Print / PDF
            </button>
          </div>
        </section>

        <p className="scope-note">
          Showing <strong>{describeFilters(filters)}</strong>
          {payload && (
            <>
              {' '}
              · {fmt(filtered.length)} of {plural(records.length, 'registration', 'registrations')}
            </>
          )}
        </p>

        {!payload && loading ? (
          <div className="loading-block">
            <span className="spinner spinner-light" aria-hidden="true" />
            Loading registrations…
          </div>
        ) : (
          <>
            <section className="kpis" aria-label="Key figures">
              <StatTile
                hero
                label="Registrations"
                value={stats.total}
                note={stats.today ? `+${fmt(stats.today)} today` : 'None yet today'}
              />
              <StatTile
                label="Checked in"
                value={stats.attended}
                note={stats.attended ? `${pct(stats.attended, stats.total)}% of registrants` : 'Scanned at /checkin'}
              />
              <StatTile
                label="Universities & organizations"
                value={stats.organizations}
                note={stats.byOrganization[0] ? `Most: ${stats.byOrganization[0].label}` : 'Represented'}
              />
              <StatTile label="Students" value={stats.students} note={`${pct(stats.students, stats.total)}% undergraduate & graduate`} />
              <StatTile
                label="Questions for the speaker"
                value={stats.questions}
                note={`${pct(stats.questions, stats.total)}% of registrants asked one`}
              />
              <StatTile
                label="Top topic"
                value={topTopic ? `${pct(topTopic.count, stats.total)}%` : '—'}
                note={topTopic ? TOPIC_SHORT[topTopic.topic as Topic] : 'No topics picked yet'}
              />
            </section>

            <section className="chart-grid">
              <article className="card">
                <header className="card-head">
                  <h2>Current affiliation</h2>
                  <p>Registrants per affiliation. Click a bar to filter the dashboard.</p>
                </header>
                <BarList
                  unit="registrants"
                  picked={filters.affiliation}
                  onPick={(k) => toggleFilter('affiliation', k)}
                  items={stats.byAffiliation.map((a) => ({
                    key: a.label,
                    label: a.label,
                    value: a.count,
                    extra: `${pct(a.count, stats.total)}%`,
                    tip: [{ value: fmt(a.count), label: `registrants · ${pct(a.count, stats.total)}% of all`, color: 'var(--s1)' }],
                  }))}
                />
              </article>

              <article className="card">
                <header className="card-head">
                  <h2>Topics of interest</h2>
                  <p>Share of registrants interested in each topic (check all that apply). Click to filter.</p>
                </header>
                <BarList
                  unit="registrants"
                  picked={filters.topic}
                  onPick={(k) => toggleFilter('topic', k)}
                  items={stats.byTopic.map((t) => ({
                    key: t.topic,
                    label: TOPIC_SHORT[t.topic as Topic] ?? t.topic,
                    value: t.count,
                    extra: `${pct(t.count, stats.total)}%`,
                    tip: [
                      { value: fmt(t.count), label: `registrants · ${pct(t.count, stats.total)}% of all`, color: 'var(--s1)' },
                      { value: '', label: t.topic },
                    ],
                  }))}
                />
              </article>

              <article className="card">
                <header className="card-head">
                  <h2>Registrations per day</h2>
                  <p>Philippine time. The busiest day is labelled.</p>
                </header>
                <ColumnChart data={stats.daily} />
                {stats.daily.length > 0 && <DailyTable data={stats.daily} />}
              </article>

              <article className="card">
                <header className="card-head">
                  <h2>Universities &amp; organizations</h2>
                  <p>Registrants per university or organization (spelling variants grouped).</p>
                </header>
                <BarList
                  unit="registrants"
                  limit={8}
                  items={stats.byOrganization.map((o) => ({
                    key: o.label,
                    label: o.label,
                    value: o.count,
                    tip: [{ value: fmt(o.count), label: o.count === 1 ? 'registrant' : 'registrants', color: 'var(--s1)' }],
                  }))}
                />
                {stats.duplicates > 0 && (
                  <p className="status status-warning dup-note">
                    <Alert width={14} height={14} />
                    {stats.duplicates} registrations share an email address — review them in the table.
                  </p>
                )}
              </article>
            </section>

            <section className="card wall-card">
              <header className="card-head">
                <h2>From the audience</h2>
                <p>What registrants want to ask the speaker and hope to learn — ready for the moderator.</p>
              </header>
              <QuestionWall rows={filtered} showAll={printing} />
            </section>

            <section className="card table-card">
              <header className="card-head">
                <h2>Registrations</h2>
                <p>{plural(filtered.length, 'registration', 'registrations')} · newest first by default. Click a column to sort.</p>
              </header>
              <ResponsesTable rows={filtered} dupKeys={dupKeys} showAll={printing} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
