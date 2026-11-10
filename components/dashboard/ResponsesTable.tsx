'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TOPIC_SHORT, type Topic } from '@/lib/config';
import { detailText, questionsFor } from '@/lib/roles';
import { affiliationLabel, duplicateKey, formatDateTime } from '@/lib/stats';
import type { Registration } from '@/lib/types';
import { Alert, Check, ChevronDown, Mail, Message, X } from '../Icons';

type SortKey = 'submittedAt' | 'name' | 'organization' | 'affiliation';
const PAGE_SIZE = 20;

const topicName = (t: string, other: string) => (t === 'Other' && other ? `Other: ${other}` : (TOPIC_SHORT[t as Topic] ?? t));

const timeOnly = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

function AttendedBadge({ at }: { at: string }) {
  return (
    <span className="status status-good" title={at ? `Checked in ${formatDateTime(at)}` : 'Checked in'}>
      <Check width={13} height={13} />
      Checked in{at ? ` ${timeOnly.format(new Date(at))}` : ''}
    </span>
  );
}

/** Resend or preview a registrant's boarding-pass email (e.g. when they say it never arrived). */
function EmailActions({ reg }: { reg: Registration }) {
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; message?: string }>({ status: 'idle' });
  async function resend() {
    setState({ status: 'sending' });
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reg.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { to?: string; message?: string };
      if (!res.ok) throw new Error(json.message || 'The email could not be sent.');
      setState({ status: 'sent', message: `Sent to ${json.to ?? reg.email}` });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'The email could not be sent.' });
    }
  }
  return (
    <div className="detail-actions">
      <button type="button" className="btn-mini" onClick={resend} disabled={state.status === 'sending' || !reg.email}>
        <Mail width={15} height={15} />
        {state.status === 'sending' ? 'Sending…' : state.status === 'sent' ? 'Send again' : 'Resend confirmation email'}
      </button>
      <a className="btn-mini" href={`/api/email/preview?id=${encodeURIComponent(reg.id)}`} target="_blank" rel="noopener">
        Preview email
      </a>
      {state.message && (
        <span className={`status ${state.status === 'sent' ? 'status-good' : 'status-warning'}`} role="status">
          {state.status === 'sent' ? <Check width={13} height={13} /> : <Alert width={13} height={13} />}
          {state.message}
        </span>
      )}
    </div>
  );
}

function DupBadge() {
  return (
    <span className="status status-warning" title="The same email address registered more than once">
      <Alert width={13} height={13} />
      Possible duplicate
    </span>
  );
}

export default function ResponsesTable({
  rows,
  dupKeys,
  showAll,
}: {
  rows: Registration[];
  dupKeys: Set<string>;
  showAll: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'submittedAt', dir: -1 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Registration | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => setPage(0), [rows]);

  useEffect(() => {
    const d = dialogRef.current;
    if (selected && d && !d.open) d.showModal();
  }, [selected]);

  const sorted = useMemo(() => {
    const val = (r: Registration) => (r[sort.key] ?? '').toString().toLowerCase();
    return [...rows].sort((a, b) => (val(a) < val(b) ? -sort.dir : val(a) > val(b) ? sort.dir : 0));
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = showAll ? sorted : sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          className={`sort-btn${active ? ' is-active' : ''}`}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'submittedAt' ? -1 : 1 }))}
        >
          {label}
          <ChevronDown width={14} height={14} className={active && sort.dir === 1 ? 'flip' : ''} />
        </button>
      </th>
    );
  };

  if (!rows.length) {
    return <p className="empty table-empty">No registrations match these filters yet.</p>;
  }

  return (
    <>
      <div className="table-scroll">
        <table className="resp-table">
          <thead>
            <tr>
              {header('submittedAt', 'Reference / Submitted')}
              {header('name', 'Registrant')}
              {header('organization', 'University / Organization')}
              {header('affiliation', 'Affiliation')}
              <th scope="col">Topics</th>
              <th scope="col" className="no-print">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td data-label="Reference">
                  <span className="cell-strong mono">{r.ref || '—'}</span>
                  <span className="cell-sub">{formatDateTime(r.submittedAt)}</span>
                </td>
                <td data-label="Registrant">
                  <span className="cell-strong">{r.name || '—'}</span>
                  <span className="cell-sub">{r.email}</span>
                  {r.attended && <AttendedBadge at={r.checkedInAt} />}
                  {dupKeys.has(duplicateKey(r)) && <DupBadge />}
                </td>
                <td data-label="Organization">{r.organization || <span className="muted">—</span>}</td>
                <td data-label="Affiliation">{affiliationLabel(r) || <span className="muted">—</span>}</td>
                <td data-label="Topics">
                  {r.topics.length ? (
                    <span className="topic-count" title={r.topics.map((t) => topicName(t, r.topicsOther)).join(', ')}>
                      {r.topics.length} {r.topics.length === 1 ? 'topic' : 'topics'}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {r.question && (
                    <span className="has-q" title="Has a question for the speaker">
                      <Message width={14} height={14} />
                      Question
                    </span>
                  )}
                </td>
                <td className="no-print cell-action">
                  <button type="button" className="btn-mini" onClick={() => setSelected(r)}>
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAll && pages > 1 && (
        <nav className="pager no-print" aria-label="Table pages">
          <button type="button" className="btn-mini" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pages} · {sorted.length} registrations
          </span>
          <button type="button" className="btn-mini" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </nav>
      )}

      <dialog
        ref={dialogRef}
        className="detail"
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {selected && (
          <div className="detail-inner">
            <header className="detail-head">
              <div>
                <p className="detail-ref mono">{selected.ref}</p>
                <h2>{selected.name}</h2>
                <p className="cell-sub">
                  {selected.email} · Submitted {formatDateTime(selected.submittedAt)}
                </p>
              </div>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => dialogRef.current?.close()}>
                <X />
              </button>
            </header>
            <div className="detail-badges">
              {selected.attended ? (
                <AttendedBadge at={selected.checkedInAt} />
              ) : (
                <span className="status status-neutral">Not checked in yet</span>
              )}
              {dupKeys.has(duplicateKey(selected)) && <DupBadge />}
              <span className="status status-neutral">Data privacy consent: {selected.consent || '—'}</span>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Sex</dt>
                <dd>{selected.sex || <span className="muted">Not asked (registered earlier)</span>}</dd>
              </div>
              <div>
                <dt>Age group</dt>
                <dd>{selected.ageGroup || <span className="muted">Not asked (registered earlier)</span>}</dd>
              </div>
              <div>
                <dt>University / Organization</dt>
                <dd>{selected.organization || '—'}</dd>
              </div>
              <div>
                <dt>Current affiliation</dt>
                <dd>{affiliationLabel(selected) || '—'}</dd>
              </div>
              {questionsFor(selected.affiliation).map((q) => (
                <div key={q.key}>
                  <dt>{q.label}</dt>
                  <dd>{detailText(selected, q) || <span className="muted">Not asked (registered earlier)</span>}</dd>
                </div>
              ))}
              <div className="span-2">
                <dt>Topics of interest</dt>
                <dd>
                  {selected.topics.length ? (
                    <ul className="topic-tags">
                      {selected.topics.map((t) => (
                        <li key={t}>{t === 'Other' && selected.topicsOther ? `Other: ${selected.topicsOther}` : t}</li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="span-2">
                <dt>Question for the speaker</dt>
                <dd className="prose">{selected.question || '—'}</dd>
              </div>
              <div className="span-2">
                <dt>What they hope to learn</dt>
                <dd className="prose">{selected.hopes || '—'}</dd>
              </div>
            </dl>
            <EmailActions key={selected.id} reg={selected} />
          </div>
        )}
      </dialog>
    </>
  );
}
