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

/** Statements, each rated from "Strongly disagree" to "Strongly agree". */
export function AgreeGrid({
  number,
  label,
  labels,
  statements,
  values,
  onChange,
  error,
}: {
  number: number;
  label: string;
  labels: readonly string[];
  statements: readonly { key: string; text: string }[];
  values: Record<string, string>;
  onChange: (key: string, v: string) => void;
  error?: string;
}) {
  const id = fieldId('statements');
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <div id={id} tabIndex={-1} role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-err` : undefined}>
        <p className="label" id={`${id}-label`}>
          <LabelText label={label} number={number} required />
        </p>
        <div className="agree">
          <div className="agree-head" aria-hidden="true">
            <span />
            {labels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
          {statements.map((s, i) => {
            const missing = Boolean(error) && !values[s.key];
            return (
              <div key={s.key} className={`agree-row${missing ? ' is-missing' : ''}`} role="radiogroup" aria-labelledby={`${id}-${s.key}`}>
                <p id={`${id}-${s.key}`}>
                  <span className="agree-n">{String.fromCharCode(97 + i)}</span>
                  {s.text}
                </p>
                <div className="agree-options">
                  {labels.map((l, n) => {
                    const v = String(n + 1);
                    return (
                      <label key={v} className={`agree-step${values[s.key] === v ? ' is-checked' : ''}`} title={l}>
                        <input type="radio" name={s.key} value={v} aria-label={l} checked={values[s.key] === v} onChange={() => onChange(s.key, v)} />
                        <span aria-hidden="true">{v}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="agree-chosen" aria-hidden="true">
                  {values[s.key] ? labels[Number(values[s.key]) - 1] : `1 ${labels[0]} · 5 ${labels[4]}`}
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
