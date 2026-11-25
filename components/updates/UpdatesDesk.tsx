'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import { formatDateTime } from '@/lib/stats';
import type { FieldErrors } from '@/lib/types';
import { EMPTY_UPDATE, normalizeUpdate, PRESETS, validateUpdate, type Audience, type UpdateContent, type UpdateSummary } from '@/lib/updates';
import { Alert, ArrowLeft, Copy, Pencil, Plus, Refresh } from '../Icons';
import { Composer, Preview } from './Composer';
import SendPanel, { Note, people, type Listed } from './SendPanel';

/** Checks what would really be saved (trimmed), so spaces alone don't count as an answer. */
const problemsIn = (c: UpdateContent) => validateUpdate(normalizeUpdate(c));

const contentOf = (u: UpdateContent): UpdateContent => ({
  subject: u.subject,
  headline: u.headline,
  message: u.message,
  before: u.before,
  now: u.now,
  buttonLabel: u.buttonLabel,
  buttonUrl: u.buttonUrl,
  audience: u.audience,
  includePass: u.includePass,
  attachInvite: u.attachInvite,
});

function statusText(u: Listed) {
  if (u.status === 'Draft') return 'Draft';
  const left = u.summary.pending + u.summary.unconfirmed.length + u.summary.failed.length;
  return `${u.status === 'Sending' ? 'Partly sent' : 'Sent'} to ${people(u.summary.sent)}${left && u.status === 'Sending' ? `, ${left} left` : ''}`;
}

/** Write an update, look at it, and email it to registrants. Nothing goes out without a confirmation. */
export default function UpdatesDesk() {
  const [updates, setUpdates] = useState<Listed[] | null>(null);
  const [audiences, setAudiences] = useState<Record<Audience, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // the open update: null id = a draft that was never saved
  const [open, setOpen] = useState<{ id: string | null; key: number } | null>(null);
  const [content, setContent] = useState<UpdateContent>(EMPTY_UPDATE);
  const [saved, setSaved] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const editorRef = useRef<HTMLElement>(null);

  const current = open?.id ? (updates?.find((u) => u.id === open.id) ?? null) : null;
  const locked = Boolean(current && current.status !== 'Draft');
  const dirty = Boolean(open) && !locked && JSON.stringify(content) !== saved;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/email/updates', { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      const json = (await res.json().catch(() => ({}))) as { updates?: Listed[]; audiences?: Record<Audience, number>; message?: string };
      if (!res.ok || !json.updates) throw new Error(json.message || 'Could not load the updates.');
      setUpdates(json.updates);
      setAudiences(json.audiences ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the updates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // After the first try, re-check as they type.
  useEffect(() => {
    if (tried) setErrors(problemsIn(content));
  }, [content, tried]);

  function show(id: string | null, c: UpdateContent, isSaved: boolean) {
    if (dirty && !window.confirm('This draft has changes that are not saved. Leave it anyway?')) return;
    setOpen({ id, key: Date.now() });
    setContent(c);
    setSaved(isSaved ? JSON.stringify(c) : '');
    setErrors({});
    setTried(false);
    setNote(null);
    setDiscarding(false);
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const startFrom = (key: string) => show(null, { ...EMPTY_UPDATE, ...PRESETS.find((p) => p.key === key)?.content }, false);

  async function save(): Promise<{ update: Listed; errors: FieldErrors } | null> {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/email/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(open?.id ? { id: open.id } : {}), content }),
      });
      const json = (await res.json().catch(() => ({}))) as { update?: Listed; errors?: FieldErrors; message?: string };
      if (!res.ok || !json.update) throw new Error(json.message || 'The draft could not be saved.');
      const u = json.update;
      setUpdates((list) => [u, ...(list ?? []).filter((x) => x.id !== u.id)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
      setOpen((o) => (o ? { ...o, id: u.id } : o));
      setSaved(JSON.stringify(content));
      return { update: u, errors: json.errors ?? {} };
    } catch (e) {
      setNote({ good: false, text: e instanceof Error ? e.message : 'The draft could not be saved.' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (await save()) setNote({ good: true, text: 'Draft saved. Nothing has been sent.' });
  }

  /** For the send step: save, and only go on when the update is complete. */
  async function saveComplete() {
    setTried(true);
    const refuse = (problems: FieldErrors) => {
      setErrors(problems);
      setNote({ good: false, text: 'Please finish the highlighted parts first.' });
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>('.upd-field.has-error input, .upd-field.has-error textarea')?.focus());
      return null;
    };
    const problems = problemsIn(content);
    setErrors(problems);
    if (Object.keys(problems).length) return refuse(problems);
    const result = await save();
    if (!result) return null;
    return Object.keys(result.errors).length ? refuse(result.errors) : result.update;
  }

  async function discard() {
    if (!open) return;
    if (open.id) {
      setBusy(true);
      const res = await fetch('/api/email/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: open.id, discard: true }),
      }).catch(() => null);
      setBusy(false);
      if (!res?.ok) return setNote({ good: false, text: 'The draft could not be discarded.' });
      setUpdates((list) => (list ?? []).filter((u) => u.id !== open.id));
    }
    setSaved(JSON.stringify(content));
    setOpen(null);
  }

  const onSummary = useCallback((id: string, summary: UpdateSummary, started: boolean) => {
    setUpdates((list) =>
      (list ?? []).map((u) =>
        u.id === id
          ? {
              ...u,
              summary,
              ...(started ? { status: !summary.pending && !summary.unconfirmed.length ? ('Sent' as const) : u.status === 'Sent' ? u.status : ('Sending' as const), sentAt: u.sentAt || new Date().toISOString() } : {}),
            }
          : u,
      ),
    );
  }, []);

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
              <p className="dash-kicker">{EVENT.series} · Email updates</p>
              <h1>{EVENT.title}</h1>
              <p className="dash-sub">Write an update and email it to registrants. Nothing is sent until you confirm.</p>
            </div>
          </div>
          <div className="dash-actions">
            <a className="head-btn" href="/dashboard">
              <ArrowLeft width={18} height={18} />
              Dashboard
            </a>
            <button type="button" className="head-btn" onClick={() => void load()} disabled={loading || sending}>
              <Refresh className={loading ? 'spin' : ''} width={18} height={18} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        {error && (
          <p className="banner banner-error" role="alert">
            <Alert />
            <span>{error}</span>
            <button type="button" className="btn-mini" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}

        <section className="card upd-start">
          <header className="card-head">
            <h2>New update</h2>
            <p>Pick a starting point; every word can be changed.</p>
          </header>
          <div className="upd-row">
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className="btn-mini" disabled={sending} onClick={() => startFrom(p.key)}>
                <Plus width={15} height={15} />
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {open && (
          <section className="upd-editor" ref={editorRef} key={open.key} aria-label="Update">
            <article className="card">
              <header className="card-head upd-editor-head">
                <div>
                  <h2>{locked ? 'Sent update' : open.id ? 'Draft' : 'New draft'}</h2>
                  <p>
                    {current ? `${current.code} · ${statusText(current)}` : 'Not saved yet'}
                    {dirty && current && ' · changes not saved'}
                  </p>
                </div>
                <button type="button" className="btn-mini" disabled={sending} onClick={() => (dirty && !window.confirm('This draft has changes that are not saved. Leave it anyway?') ? undefined : setOpen(null))}>
                  Close
                </button>
              </header>
              {locked && (
                <p className="upd-locked">
                  This update has started going out, so its words can&rsquo;t change.{' '}
                  <button type="button" className="btn-mini" disabled={sending} onClick={() => show(null, content, false)}>
                    <Copy width={15} height={15} />
                    Use as a new draft
                  </button>
                </p>
              )}
              <Composer content={content} onChange={setContent} errors={errors} audiences={audiences} locked={locked || sending} />
              {!locked && (
                <div className="upd-row upd-save">
                  <button type="button" className="btn-mini" disabled={busy || sending || !dirty} onClick={() => void saveDraft()}>
                    {busy ? 'Saving…' : 'Save draft'}
                  </button>
                  {!discarding ? (
                    <button type="button" className="btn-mini" disabled={busy || sending} onClick={() => setDiscarding(true)}>
                      Discard…
                    </button>
                  ) : (
                    <>
                      <span className="upd-hint">Put this draft away?</span>
                      <button type="button" className="btn-mini" disabled={busy} onClick={() => void discard()}>
                        Yes, discard
                      </button>
                      <button type="button" className="btn-mini" onClick={() => setDiscarding(false)}>
                        Keep it
                      </button>
                    </>
                  )}
                </div>
              )}
              {note && <Note good={note.good}>{note.text}</Note>}
            </article>
            <div className="upd-side">
              <article className="card">
                <header className="card-head">
                  <h2>Preview</h2>
                </header>
                <Preview content={content} />
              </article>
              <SendPanel update={current} content={content} onSave={saveComplete} onSummary={onSummary} onSending={setSending} />
            </div>
          </section>
        )}

        <section className="card upd-list-card">
          <header className="card-head">
            <h2>Drafts and sent updates</h2>
            <p>Kept in Airtable (Email Updates), so every organizer sees the same list.</p>
          </header>
          {!updates && loading && <p className="muted">Loading…</p>}
          {updates && updates.length === 0 && <p className="empty">No updates yet. Start one above.</p>}
          {updates && updates.length > 0 && (
            <ul className="upd-list">
              {updates.map((u) => (
                <li key={u.id} className={open?.id === u.id ? 'is-open' : undefined}>
                  <div>
                    <b>{u.subject || '(no subject yet)'}</b>
                    <small>
                      {u.audience} · {u.code} · {u.status === 'Draft' ? `started ${formatDateTime(u.createdAt)}` : `sent ${formatDateTime(u.sentAt || u.createdAt)}`}
                    </small>
                  </div>
                  <span className={`status ${u.status === 'Sent' ? 'status-good' : u.status === 'Draft' ? 'status-neutral' : 'status-warning'}`}>{statusText(u)}</span>
                  <button type="button" className="btn-mini" disabled={sending || open?.id === u.id} onClick={() => show(u.id, contentOf(u), true)}>
                    {u.status === 'Draft' && <Pencil width={15} height={15} />}
                    {u.status === 'Draft' ? 'Edit' : 'Open'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
