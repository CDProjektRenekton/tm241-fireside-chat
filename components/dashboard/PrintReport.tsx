'use client';

import type { ReactNode } from 'react';
import { EVENT, TOPIC_SHORT, type Topic } from '@/lib/config';
import { detailText, questionsFor } from '@/lib/roles';
import { affiliationLabel, duplicateKey, formatDateTime, type Stats } from '@/lib/stats';
import type { Registration } from '@/lib/types';
import { pct } from './Charts';

/*
 * The "Print / PDF" report: an A4 document laid out for reading on paper or as a PDF, instead of
 * a squeezed copy of the interactive dashboard. Rendered only while printing (see Dashboard.tsx)
 * and styled by the @media print rules in app/dashboard/dashboard.css.
 */

const fmt = (n: number) => n.toLocaleString('en-PH');
const dayLabel = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
const shortStamp = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

interface BarRow {
  label: string;
  count: number;
  note?: string;
}

/** Label · bar · count · share, one row per answer. */
function Bars({ items, total }: { items: BarRow[]; total: number }) {
  if (!items.some((i) => i.count > 0)) return <p className="pr-empty">No answers in this selection yet.</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <table className="pr-bars">
      <tbody>
        {items.map((i) => (
          <tr key={i.label}>
            <th scope="row">
              {i.label}
              {i.note && <small>{i.note}</small>}
            </th>
            <td className="pr-bar">{i.count > 0 && <span style={{ width: `${(i.count / max) * 100}%` }} />}</td>
            <td className="pr-num">{fmt(i.count)}</td>
            <td className="pr-pct">{pct(i.count, total)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="pr-block">
      <h3>{title}</h3>
      {note && <p className="pr-note">{note}</p>}
      {children}
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="pr-kpi">
      <span>{label}</span>
      <b>{fmt(value)}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

function Audience({ title, rows, field }: { title: string; rows: Registration[]; field: 'question' | 'hopes' }) {
  return (
    <section className="pr-audience">
      <h3>
        {title} <span>({fmt(rows.length)})</span>
      </h3>
      {rows.length ? (
        <ol>
          {rows.map((r) => (
            <li key={r.id}>
              <p>{r[field]}</p>
              <small>
                — {r.name}
                {r.organization && `, ${r.organization}`}
                {r.affiliation && ` · ${affiliationLabel(r)}`}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pr-empty">None in this selection.</p>
      )}
    </section>
  );
}

export default function PrintReport({
  rows,
  stats,
  filterLabel,
  totalAll,
  fetchedAt,
  dupKeys,
}: {
  rows: Registration[];
  stats: Stats;
  filterLabel: string;
  totalAll: number;
  fetchedAt?: string;
  dupKeys: Set<string>;
}) {
  const sexAnswered = stats.bySex.reduce((n, s) => n + s.count, 0);
  const ageAnswered = stats.byAge.reduce((n, a) => n + a.count, 0);
  const notAsked = stats.demographicsNotAsked
    ? `${fmt(stats.demographicsNotAsked)} earlier registration${stats.demographicsNotAsked === 1 ? ' was' : 's were'} not asked; shares are of those who answered.`
    : undefined;
  const roles = stats.byRole.filter((b) => b.total > b.notAsked);
  const byName = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const newestFirst = (field: 'question' | 'hopes') => rows.filter((r) => r[field]);

  return (
    <div className="print-report">
      <header className="pr-head">
        <div className="pr-logos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/up-seal.png" alt="University of the Philippines" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tmc-logo.png" alt="UP Technology Management Center" />
        </div>
        <div>
          <p className="pr-kicker">{EVENT.series} · Registration report</p>
          <h1>{EVENT.title}</h1>
          <p className="pr-event">
            {EVENT.weekday}, {EVENT.dateEn} · {EVENT.time} · {EVENT.venue}, UP Diliman
          </p>
        </div>
      </header>

      <p className="pr-scope">
        <b>{filterLabel}</b> · {fmt(rows.length)} of {fmt(totalAll)} registrations · Generated {formatDateTime(new Date().toISOString())}
        {fetchedAt && ` from data loaded ${formatDateTime(fetchedAt)}`}
      </p>

      <section className="pr-kpis" aria-label="Key figures">
        <Kpi label="Registrations" value={stats.total} note={stats.today ? `+${fmt(stats.today)} today` : undefined} />
        <Kpi label="Checked in" value={stats.attended} note={`${pct(stats.attended, stats.total)}% of registrants`} />
        <Kpi label="Universities & organizations" value={stats.organizations} />
        <Kpi label="Students" value={stats.students} note={`${pct(stats.students, stats.total)}% undergraduate & graduate`} />
        <Kpi label="Questions for the speaker" value={stats.questions} note={`${pct(stats.questions, stats.total)}% asked one`} />
        <Kpi label="Shared what they hope to learn" value={stats.hopes} />
        <Kpi label="Picked a topic" value={stats.topicResponders} note={`${pct(stats.topicResponders, stats.total)}% of registrants`} />
        <Kpi label="Possible duplicates" value={stats.duplicates} note="same email address" />
      </section>

      <h2 className="pr-h2">Who registered</h2>
      <div className="pr-grid">
        <Block title="Current affiliation">
          <Bars items={stats.byAffiliation} total={stats.total} />
        </Block>
        <Block title="Topics of interest" note="Check all that apply; share of all registrants.">
          <Bars items={stats.byTopic.map((t) => ({ label: TOPIC_SHORT[t.topic as Topic] ?? t.topic, count: t.count }))} total={stats.total} />
        </Block>
        <Block title="Sex" note={notAsked}>
          <Bars items={stats.bySex} total={sexAnswered} />
        </Block>
        <Block title="Age group" note={notAsked}>
          <Bars items={stats.byAge} total={ageAnswered} />
        </Block>
        <Block title="Registrations per day" note="Philippine time.">
          <Bars items={stats.daily.map((d) => ({ label: dayLabel.format(new Date(`${d.day}T12:00:00+08:00`)), count: d.count }))} total={stats.total} />
        </Block>
        <Block
          title="Universities & organizations"
          note={`Spelling variants grouped.${stats.byOrganization.length > 15 ? ` Top 15 of ${fmt(stats.byOrganization.length)}.` : ''}`}
        >
          <Bars items={stats.byOrganization.slice(0, 15)} total={stats.total} />
        </Block>
      </div>

      <h2 className="pr-h2 pr-new-page">Affiliation details</h2>
      <p className="pr-note pr-lead">
        Answers to each affiliation&rsquo;s follow-up questions. Shares are of those who answered; typed answers are grouped
        when they differ only in capitals or punctuation.
      </p>
      {roles.length === 0 && <p className="pr-empty">No follow-up answers in this selection yet.</p>}
      {roles.map((b) => (
        <section className="pr-role" key={b.affiliation}>
          <h3>
            {b.affiliation}{' '}
            <span>
              {fmt(b.total - b.notAsked)} answered
              {b.notAsked > 0 && ` · ${fmt(b.notAsked)} registered before these questions`}
            </span>
          </h3>
          <div className="pr-grid">
            {b.questions.map((q) => (
              <Block
                key={q.key}
                title={q.median !== undefined ? `${q.label} · median ${q.median} ${q.median === 1 ? 'year' : 'years'}` : q.label}
                note={q.kind === 'text' && q.items.length > 8 ? `Top 8 of ${fmt(q.items.length)} different answers.` : undefined}
              >
                <Bars
                  items={(q.kind === 'text' ? q.items.slice(0, 8) : q.items).map((i) => ({
                    label: i.label,
                    count: i.count,
                    note: i.examples?.length ? `Typed: ${i.examples.slice(0, 4).join(', ')}${i.examples.length > 4 ? '…' : ''}` : undefined,
                  }))}
                  total={q.answered}
                />
              </Block>
            ))}
          </div>
        </section>
      ))}

      <h2 className="pr-h2 pr-new-page">From the audience</h2>
      <p className="pr-note pr-lead">For the moderator. Newest first.</p>
      <Audience title="Questions for the speaker" rows={newestFirst('question')} field="question" />
      <Audience title="What they hope to learn" rows={newestFirst('hopes')} field="hopes" />

      <h2 className="pr-h2 pr-new-page">Registrations</h2>
      <p className="pr-note pr-lead">
        {fmt(rows.length)} {rows.length === 1 ? 'registration' : 'registrations'}, sorted by name. ✓ = checked in at the event.
      </p>
      {byName.length === 0 ? (
        <p className="pr-empty">No registrations match these filters yet.</p>
      ) : (
        <table className="pr-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Registrant</th>
              <th scope="col">University / Organization</th>
              <th scope="col">Affiliation</th>
              <th scope="col">Sex · Age</th>
              <th scope="col">Registered</th>
              <th scope="col">Checked in</th>
            </tr>
          </thead>
          <tbody>
            {byName.map((r, i) => {
              const details = questionsFor(r.affiliation)
                .map((q) => detailText(r, q))
                .filter(Boolean)
                .join(' · ');
              return (
                <tr key={r.id}>
                  <td className="pr-n">{i + 1}</td>
                  <td>
                    <b>{r.name || '—'}</b>
                    <small className="pr-email">{r.email}</small>
                    <small className="pr-mono">
                      {r.ref}
                      {dupKeys.has(duplicateKey(r)) && ' · possible duplicate'}
                    </small>
                  </td>
                  <td>{r.organization || '—'}</td>
                  <td>
                    {affiliationLabel(r) || '—'}
                    {details && <small>{details}</small>}
                  </td>
                  <td>
                    {r.sex || '—'}
                    {r.ageGroup && <small>{r.ageGroup}</small>}
                  </td>
                  <td>{shortStamp.format(new Date(r.submittedAt))}</td>
                  <td>{r.attended ? `✓ ${r.checkedInAt ? shortStamp.format(new Date(r.checkedInAt)) : ''}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
