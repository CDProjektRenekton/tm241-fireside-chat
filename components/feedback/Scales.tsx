'use client';

import { memo } from 'react';
import { fieldId, FieldError, LabelText } from '../form/Fields';

interface ScaleProps {
  name: string;
  number: number;
  label: string;
  hint?: string;
  /** Values in order, with the words a screen reader hears. */
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  /** Words under the two ends of the scale. */
  ends: readonly [string, string];
  /** Shows the chosen option's words beside the ends (for 1 to 5 ratings). */
  showChosen?: boolean;
}

/** A row of numbers to choose from: 1 to 5, or 0 to 10. */
function ScaleFieldImpl(p: ScaleProps) {
  const id = fieldId(p.name);
  const at = p.options.findIndex((o) => o.value === p.value);
  const last = p.options.length - 1;
  return (
    <div className={`field${p.error ? ' has-error' : ''}`}>
      <div
        role="radiogroup"
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={[p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined}
        aria-required
        aria-invalid={p.error ? true : undefined}
      >
        <p className="label" id={`${id}-label`}>
          <LabelText label={p.label} number={p.number} required />
        </p>
        {p.hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        )}
        <div className={`scale scale-${p.options.length}`}>
          {p.options.map((o) => (
            <label key={o.value} className={`scale-step${p.value === o.value ? ' is-checked' : ''}`} title={o.label}>
              <input type="radio" name={p.name} value={o.value} aria-label={o.label === o.value ? o.value : `${o.value}, ${o.label}`} checked={p.value === o.value} onChange={() => p.onChange(o.value)} />
              <span aria-hidden="true">{o.value}</span>
            </label>
          ))}
        </div>
        <p className="scale-ends" aria-hidden="true">
          <span className={at === 0 ? 'is-chosen' : undefined}>{p.ends[0]}</span>
          {p.showChosen && at > 0 && at < last && <b>{p.options[at].label}</b>}
          <span className={at === last ? 'is-chosen' : undefined}>{p.ends[1]}</span>
        </p>
      </div>
      <FieldError id={id} error={p.error} />
    </div>
  );
}
export const ScaleField = memo(ScaleFieldImpl);

/**
 * Rows answered on the same choices, e.g. each part of the event from 1 to 5 (or N/A). On a phone each row
 * becomes its own card, with the meaning of its choices underneath.
 */
export function ChoiceGrid({
  name,
  number,
  label,
  hint,
  columns,
  rows,
  values,
  onChange,
  error,
  legend,
  wide = false,
}: {
  name: string;
  number: number;
  label: string;
  hint?: string;
  /** value: what is saved; label: the words (heading and screen readers); short: what the button shows. */
  columns: readonly { value: string; label: string; short?: string }[];
  rows: readonly { key: string; text: string }[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  error?: string;
  /** Under each row on a phone, until it is answered. */
  legend: string;
  /** Columns with words instead of numbers need more room. */
  wide?: boolean;
}) {
  const id = fieldId(name);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <div id={id} tabIndex={-1} role="group" aria-labelledby={`${id}-label`} aria-describedby={[hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined}>
        <p className="label" id={`${id}-label`}>
          <LabelText label={label} number={number} required />
        </p>
        {hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )}
        <div className={`agree${wide ? ' is-wide' : ''}`} style={{ '--cols': columns.length } as React.CSSProperties}>
          <div className="agree-head" aria-hidden="true">
            <span />
            {columns.map((c) => (
              <span key={c.value}>{c.short ? c.short : c.label}</span>
            ))}
          </div>
          {rows.map((r, i) => {
            const missing = Boolean(error) && !values[r.key];
            const chosen = columns.find((c) => c.value === values[r.key]);
            return (
              <div key={r.key} className={`agree-row${missing ? ' is-missing' : ''}`} role="radiogroup" aria-labelledby={`${id}-${r.key}`}>
                <p id={`${id}-${r.key}`}>
                  <span className="agree-n">{String.fromCharCode(97 + i)}</span>
                  {r.text}
                </p>
                <div className="agree-options">
                  {columns.map((c) => (
                    <label key={c.value} className={`agree-step${values[r.key] === c.value ? ' is-checked' : ''}`} title={c.label}>
                      <input type="radio" name={r.key} value={c.value} aria-label={c.label} checked={values[r.key] === c.value} onChange={() => onChange(r.key, c.value)} />
                      <span aria-hidden="true">{c.short ?? c.value}</span>
                    </label>
                  ))}
                </div>
                <p className="agree-chosen" aria-hidden="true">
                  {chosen ? chosen.label : legend}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}

const STAR = 'M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

/** One to five stars. */
export function StarRating({
  name,
  number,
  label,
  hint,
  value,
  onChange,
  error,
  words,
}: {
  name: string;
  number: number;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  /** What 1 and 5 mean, for screen readers and the caption. */
  words: readonly [string, string];
}) {
  const id = fieldId(name);
  const n = Number(value) || 0;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <div
        role="radiogroup"
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined}
        aria-required
        aria-invalid={error ? true : undefined}
      >
        <p className="label" id={`${id}-label`}>
          <LabelText label={label} number={number} required />
        </p>
        {hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )}
        <div className="rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className={`rating-star${i <= n ? ' is-on' : ''}`}>
              <input
                type="radio"
                name={name}
                value={String(i)}
                aria-label={i === 1 ? `1 star, ${words[0]}` : i === 5 ? `5 stars, ${words[1]}` : `${i} stars`}
                checked={value === String(i)}
                onChange={() => onChange(String(i))}
              />
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR} />
              </svg>
              <span className="rating-n" aria-hidden="true">
                {i}
              </span>
            </label>
          ))}
          <span className="rating-said" aria-hidden="true">
            {n ? `${n} of 5${n === 1 ? ` · ${words[0]}` : n === 5 ? ` · ${words[1]}` : ''}` : ''}
          </span>
        </div>
      </div>
      <FieldError id={id} error={error} />
    </div>
  );
}
