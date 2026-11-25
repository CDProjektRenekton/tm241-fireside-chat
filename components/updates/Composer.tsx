'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FieldErrors } from '@/lib/types';
import { AUDIENCES, UPDATE_LIMITS, type Audience, type UpdateContent } from '@/lib/updates';

const AUDIENCE_HINT: Record<Audience, string> = {
  Everyone: 'All registrants',
  Onsite: 'Coming in person',
  Online: 'Joining on Zoom',
  'Checked in': 'Arrived at the event',
};

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`upd-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id, describedBy)}
      {hint && (
        <small id={`${id}-h`} className="upd-hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-e`} className="upd-error">
          {error}
        </small>
      )}
    </div>
  );
}

/** The words and options of an update. Read-only once it has started going out. */
export function Composer({
  content,
  onChange,
  errors,
  audiences,
  locked,
}: {
  content: UpdateContent;
  onChange: (c: UpdateContent) => void;
  errors: FieldErrors;
  audiences: Record<Audience, number> | null;
  locked: boolean;
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof UpdateContent>(key: K, value: UpdateContent[K]) => onChange({ ...content, [key]: value });

  const line = (key: 'subject' | 'headline' | 'before' | 'now' | 'buttonLabel' | 'buttonUrl', label: string, placeholder: string, hint?: string) => (
    <Field label={label} hint={hint} error={errors[key]}>
      {(id, by) => (
        <input
          id={id}
          name={key}
          aria-describedby={by}
          aria-invalid={errors[key] ? true : undefined}
          type={key === 'buttonUrl' ? 'url' : 'text'}
          maxLength={UPDATE_LIMITS[key]}
          placeholder={placeholder}
          value={content[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  /** Puts text around (or at) the selection in the message. */
  function edit(change: (selected: string) => string) {
    const el = messageRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const inserted = change(value.slice(a, b));
    set('message', (value.slice(0, a) + inserted + value.slice(b)).slice(0, UPDATE_LIMITS.message));
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a, a + inserted.length);
    });
  }

  return (
    <fieldset className="upd-form" disabled={locked}>
      {line('subject', 'Subject', 'What they see in their inbox')}
      {line('headline', 'Headline', 'The big words at the top of the email')}

      <Field
        label="Message"
        hint="Leave an empty line between paragraphs. Start a line with “- ” for a bullet. Links become clickable. It already begins with “Hi” and their first name."
        error={errors.message}
      >
        {(id, by) => (
          <>
            <div className="upd-tools" role="group" aria-label="Formatting">
              <button type="button" className="btn-mini" onClick={() => edit((s) => `**${s || 'bold words'}**`)}>
                <b>Bold</b>
              </button>
              <button
                type="button"
                className="btn-mini"
                onClick={() =>
                  edit((s) =>
                    (s || 'first point\nsecond point')
                      .split('\n')
                      .map((l) => (l.trim() ? `- ${l.replace(/^[-•]\s+/, '')}` : l))
                      .join('\n'),
                  )
                }
              >
                • Bullets
              </button>
              <button type="button" className="btn-mini" onClick={() => edit(() => '{name}')} title="Their first name">
                {'{name}'}
              </button>
              <button type="button" className="btn-mini" onClick={() => edit(() => '{ref}')} title="Their reference number">
                {'{ref}'}
              </button>
              <span className="upd-count">
                {content.message.length} / {UPDATE_LIMITS.message}
              </span>
            </div>
            <textarea
              id={id}
              ref={messageRef}
              name="message"
              rows={9}
              aria-describedby={by}
              aria-invalid={errors.message ? true : undefined}
              maxLength={UPDATE_LIMITS.message}
              value={content.message}
              onChange={(e) => set('message', e.target.value)}
            />
          </>
        )}
      </Field>

      <details className="upd-more" open={Boolean(content.now || content.before || errors.now)}>
        <summary>Was / Now box (optional)</summary>
        <p className="upd-hint">For a change, e.g. a new time or venue. Shows the old value crossed out and the new one big.</p>
        <div className="upd-two">
          {line('before', 'Was', 'e.g. 1:30 PM – 3:30 PM')}
          {line('now', 'Now', 'e.g. 1:00 PM – 3:00 PM')}
        </div>
      </details>

      <details className="upd-more" open={Boolean(content.buttonLabel || content.buttonUrl || errors.buttonUrl || errors.buttonLabel)}>
        <summary>Button (optional)</summary>
        <div className="upd-two">
          {line('buttonLabel', 'Words on the button', 'e.g. Give feedback')}
          {line('buttonUrl', 'Link it opens', 'https://…')}
        </div>
      </details>

      <div className="upd-field">
        <span className="upd-legend" id="upd-audience">
          Send to
        </span>
        <div className="upd-audience" role="radiogroup" aria-labelledby="upd-audience">
          {AUDIENCES.map((a) => (
            <label key={a} className={content.audience === a ? 'is-picked' : undefined}>
              <input type="radio" name="audience" value={a} checked={content.audience === a} onChange={() => set('audience', a)} />
              <b>{a}</b>
              <small>
                {AUDIENCE_HINT[a]}
                {audiences && ` · ${audiences[a]}`}
              </small>
            </label>
          ))}
        </div>
      </div>

      <div className="upd-field">
        <span className="upd-legend">Include</span>
        <label className="upd-check">
          <input type="checkbox" name="includePass" checked={content.includePass} onChange={(e) => set('includePass', e.target.checked)} />
          <span>
            <b>Their boarding pass</b>
            <small>QR code and directions for onsite, Join on Zoom for online</small>
          </span>
        </label>
        <label className="upd-check">
          <input type="checkbox" name="attachInvite" checked={content.attachInvite} onChange={(e) => set('attachInvite', e.target.checked)} />
          <span>
            <b>Calendar invite</b>
            <small>Attached, with an Add to Google Calendar button. Uses the event&rsquo;s current date and time.</small>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

/** The email as it will look, re-drawn as the organizer types. */
export function Preview({ content }: { content: UpdateContent }) {
  const [mode, setMode] = useState<'Onsite' | 'Online'>(content.audience === 'Online' ? 'Online' : 'Onsite');
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [shown, setShown] = useState<{ subject: string; html: string } | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (content.audience === 'Online') setMode('Online');
    if (content.audience === 'Onsite' || content.audience === 'Checked in') setMode('Onsite');
  }, [content.audience]);

  useEffect(() => {
    const stop = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/email/updates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, mode }),
          signal: stop.signal,
        });
        const json = (await res.json().catch(() => ({}))) as { subject?: string; html?: string; message?: string };
        if (!res.ok || !json.html) throw new Error(json.message || 'The preview could not be drawn.');
        setShown({ subject: json.subject ?? '', html: json.html });
        setProblem('');
      } catch (e) {
        if (!stop.signal.aborted) setProblem(e instanceof Error ? e.message : 'The preview could not be drawn.');
      }
    }, 450);
    return () => {
      stop.abort();
      window.clearTimeout(t);
    };
  }, [content, mode]);

  return (
    <div className="upd-preview">
      <div className="upd-preview-bar">
        <div className="upd-switch" role="group" aria-label="Version">
          {(['Onsite', 'Online'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <div className="upd-switch" role="group" aria-label="Screen">
          {(['desktop', 'phone'] as const).map((w) => (
            <button key={w} type="button" aria-pressed={width === w} onClick={() => setWidth(w)}>
              {w === 'desktop' ? 'Desktop' : 'Phone'}
            </button>
          ))}
        </div>
      </div>
      <p className="upd-subject">
        <span>Subject</span> {shown?.subject || <em>(no subject yet)</em>}
      </p>
      {problem && <p className="upd-error">{problem}</p>}
      <div className={`upd-frame is-${width}`}>
        {shown ? <iframe title="Email preview" sandbox="" srcDoc={shown.html} /> : <p className="muted">Drawing the preview…</p>}
      </div>
      <p className="upd-hint">Sample details; the links here don&rsquo;t open. Each person gets their own name, reference and pass.</p>
    </div>
  );
}
