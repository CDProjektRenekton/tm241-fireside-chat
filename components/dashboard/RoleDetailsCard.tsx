'use client';

import { useEffect, useState } from 'react';
import type { RoleBreakdown } from '@/lib/stats';
import { BarList, pct } from './Charts';

const fmt = (n: number) => n.toLocaleString('en-PH');

/** Up to three typed "Other" answers, e.g. "Freelance, Consultant, Volunteer…". */
const examplesText = (ex?: string[]) =>
  ex?.length ? `${ex.slice(0, 3).join(', ')}${ex.length > 3 ? '…' : ''}` : undefined;

/**
 * Answers to the follow-up questions under "Current Affiliation", one tab per affiliation.
 * Follows the dashboard's affiliation filter when it is set.
 */
export default function RoleDetailsCard({ byRole, filterAffiliation }: { byRole: RoleBreakdown[]; filterAffiliation: string }) {
  const [tab, setTab] = useState('');

  useEffect(() => {
    if (byRole.some((b) => b.affiliation === filterAffiliation)) setTab(filterAffiliation);
  }, [filterAffiliation, byRole]);

  // Until a tab is picked, open the affiliation with the most registrants.
  const fallback = [...byRole].sort((a, b) => b.total - a.total)[0];
  const active = byRole.find((b) => b.affiliation === tab) ?? fallback;
  if (!active) return null;
  const answered = active.total - active.notAsked;
  const slug = (a: string) => a.toLowerCase().replace(/[^a-z]+/g, '-');

  return (
    <article className="card card-wide">
      <header className="card-head">
        <h2>Affiliation details</h2>
        <p>
          Answers to each affiliation&rsquo;s follow-up questions. Typed answers are grouped when they differ only in
          capitals or punctuation.
        </p>
      </header>

      <div className="tabs role-tabs" role="tablist" aria-label="Affiliation">
        {byRole.map((b) => {
          const on = b.affiliation === active.affiliation;
          return (
            <button
              key={b.affiliation}
              type="button"
              role="tab"
              id={`role-tab-${slug(b.affiliation)}`}
              aria-selected={on}
              aria-controls="role-tabpanel"
              className={on ? 'is-active' : ''}
              onClick={() => setTab(b.affiliation)}
            >
              {b.affiliation} <span className="count">{fmt(b.total)}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="role-tabpanel" aria-labelledby={`role-tab-${slug(active.affiliation)}`} className="role-tabpanel">
        {answered === 0 ? (
          <p className="empty">No {active.affiliation.toLowerCase()} answers for this selection yet.</p>
        ) : (
          <div className="demo-grid">
            {active.questions.map((q) => (
              <div key={q.key}>
                <h3 className="sub-head">
                  {q.label}
                  {q.median !== undefined && (
                    <span className="sub-meta">
                      {' '}
                      · median {q.median} {q.median === 1 ? 'year' : 'years'}
                    </span>
                  )}
                </h3>
                <BarList
                  unit="registrants"
                  limit={q.kind === 'text' ? 6 : 12}
                  items={q.items.map((i) => ({
                    key: i.label,
                    label: i.label,
                    sub: examplesText(i.examples),
                    value: i.count,
                    extra: `${pct(i.count, q.answered)}%`,
                    tip: [
                      {
                        value: fmt(i.count),
                        label: `registrants · ${pct(i.count, q.answered)}% of ${q.answered} who answered`,
                        color: 'var(--s1)',
                      },
                      ...(i.examples?.length ? [{ value: '', label: `Typed: ${i.examples.slice(0, 6).join(', ')}` }] : []),
                    ],
                  }))}
                />
              </div>
            ))}
          </div>
        )}
        {active.notAsked > 0 && (
          <p className="muted demo-note">
            {fmt(active.notAsked)} {active.affiliation.toLowerCase()} {active.notAsked === 1 ? 'registration' : 'registrations'}{' '}
            from before these questions were added {active.notAsked === 1 ? 'has' : 'have'} no answers and{' '}
            {active.notAsked === 1 ? 'is' : 'are'} not counted here.
          </p>
        )}
      </div>
    </article>
  );
}
