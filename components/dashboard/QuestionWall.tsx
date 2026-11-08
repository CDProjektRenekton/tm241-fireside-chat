'use client';

import { useState } from 'react';
import { affiliationLabel, formatDateTime } from '@/lib/stats';
import type { Registration } from '@/lib/types';
import { Check, Copy, Lightbulb, Message } from '../Icons';

type Tab = 'question' | 'hopes';
const LIMIT = 9;

/** Questions for the speaker and learning goals, ready for the moderator. */
export default function QuestionWall({ rows, showAll: forceAll }: { rows: Registration[]; showAll: boolean }) {
  const [tab, setTab] = useState<Tab>('question');
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const items = rows.filter((r) => r[tab]);
  const counts = { question: rows.filter((r) => r.question).length, hopes: rows.filter((r) => r.hopes).length };
  const shown = all || forceAll ? items : items.slice(0, LIMIT);

  async function copyAll() {
    const text = items
      .map((r, i) => `${i + 1}. ${r[tab].replace(/\s*\n\s*/g, ' ')}\n   — ${r.name}, ${r.organization} (${affiliationLabel(r)})`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <>
      <div className="wall-bar">
        <div className="tabs" role="tablist" aria-label="Audience answers">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'question'}
            className={tab === 'question' ? 'is-active' : ''}
            onClick={() => {
              setTab('question');
              setAll(false);
            }}
          >
            <Message width={16} height={16} />
            Questions for the speaker <span className="count">{counts.question}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'hopes'}
            className={tab === 'hopes' ? 'is-active' : ''}
            onClick={() => {
              setTab('hopes');
              setAll(false);
            }}
          >
            <Lightbulb width={16} height={16} />
            Hopes to learn <span className="count">{counts.hopes}</span>
          </button>
        </div>
        {items.length > 0 && (
          <button type="button" className="btn-mini no-print" onClick={() => void copyAll()}>
            {copied ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
            {copied ? 'Copied' : `Copy all ${items.length}`}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="empty">
          {tab === 'question' ? 'No questions for the speaker in this selection yet.' : 'No learning goals shared in this selection yet.'}
        </p>
      ) : (
        <ol className="wall">
          {shown.map((r) => (
            <li key={r.id} className="quote">
              <p className="quote-text">{r[tab]}</p>
              <p className="quote-by">
                <b>{r.name}</b>
                <span>
                  {r.organization}
                  {r.affiliation && ` · ${affiliationLabel(r)}`}
                </span>
                <time dateTime={r.submittedAt}>{formatDateTime(r.submittedAt)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}

      {!forceAll && items.length > LIMIT && (
        <button type="button" className="link-btn no-print" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </>
  );
}
