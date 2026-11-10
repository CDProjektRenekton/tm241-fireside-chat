'use client';

import { Fragment, memo, useState, type ReactNode } from 'react';
import { YEARS_MAX } from '@/lib/roles';
import { Alert, Check, ChevronDown, Minus, Plus } from '../Icons';

export const fieldId = (key: string) => `f-${key.replace(/\./g, '-')}`;

interface LabelProps {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  /** Question number: 6 shows as "06"; a string ("06.1") shows as is. */
  number?: number | string;
}

export function LabelText({ label, required, optional, number }: LabelProps) {
  return (
    <span className="label-text">
      {number !== undefined && (
        <span className="q-num">{typeof number === 'string' ? number : String(number).padStart(2, '0')}</span>
      )}
      <span>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="opt">Optional</span>}
      </span>
    </span>
  );
}

export function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p className="field-error" id={`${id}-err`} role="alert">
      <Alert width={16} height={16} />
      {error}
    </p>
  );
}

interface TextFieldProps extends LabelProps {
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: 'text' | 'email';
  autoComplete?: string;
  inputMode?: 'text' | 'email';
  placeholder?: string;
  icon?: ReactNode;
  multiline?: boolean;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  /** Renders without the outer label (for inline "Other" boxes). */
  bare?: boolean;
}

function TextFieldImpl(p: TextFieldProps) {
  const id = fieldId(p.name);
  const max = p.maxLength ?? 150;
  const describedBy = [p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: p.name,
    value: p.value,
    placeholder: p.placeholder,
    required: p.required,
    maxLength: max,
    autoFocus: p.autoFocus,
    'aria-invalid': p.error ? true : undefined,
    'aria-describedby': describedBy,
    'aria-label': p.bare ? p.label : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => p.onChange(e.target.value),
  };
  const filled = p.value.trim().length > 0;
  return (
    <div className={`field${p.error ? ' has-error' : ''}${filled ? ' is-filled' : ''}${p.bare ? ' field-bare' : ''}`}>
      {!p.bare && (
        <label htmlFor={id} className="label">
          <LabelText {...p} />
        </label>
      )}
      {!p.bare && p.hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {p.hint}
        </p>
      )}
      <div className={`control${p.icon ? ' with-icon' : ''}${p.multiline ? ' is-multiline' : ''}`}>
        {p.icon && <span className="control-icon">{p.icon}</span>}
        {p.multiline ? (
          <textarea {...common} rows={p.rows ?? 4} />
        ) : (
          <input {...common} type={p.type ?? 'text'} autoComplete={p.autoComplete} inputMode={p.inputMode} />
        )}
        <span className="control-glow" aria-hidden="true" />
        {!p.multiline && filled && !p.error && (
          <span className="control-ok" aria-hidden="true">
            <Check width={16} height={16} />
          </span>
        )}
      </div>
      {p.multiline && (
        <p className={`char-count${p.value.length > max * 0.9 ? ' is-near' : ''}`} aria-hidden="true">
          {p.value.length.toLocaleString('en-PH')} / {max.toLocaleString('en-PH')}
        </p>
      )}
      <FieldError id={id} error={p.error} />
    </div>
  );
}

/** Particle burst played on the element that was just picked. */
function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ '--a': `${i * 45}deg` } as React.CSSProperties} />
      ))}
    </span>
  );
}

export interface CardOption {
  value: string;
  label: string;
  icon?: ReactNode;
  sub?: string;
}

interface CardChoiceProps extends LabelProps {
  name: string;
  value: string;
  options: readonly CardOption[];
  onChange: (v: string) => void;
  error?: string;
  className?: string;
  children?: ReactNode;
  /** Opens like an accordion right under the chosen card (full width), e.g. follow-up questions. */
  detail?: ReactNode;
}

/**
 * The accordion panel under a chosen card: unfolds (pushing the cards below it down), then lets
 * its content overflow again so focus rings and shadows aren't clipped.
 */
function Unfold({ side, children }: { side: 'left' | 'right'; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`card-detail${open ? ' is-open' : ''}`}
      data-side={side}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setOpen(true);
      }}
    >
      <div className="card-detail-in">{children}</div>
    </div>
  );
}

/** Single-choice cards (radio group). */
function CardChoiceImpl(p: CardChoiceProps) {
  const id = fieldId(p.name);
  const [pulse, setPulse] = useState('');
  return (
    <div className={`field${p.error ? ' has-error' : ''}`}>
      <div
        role="radiogroup"
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={[p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined}
        aria-required={p.required}
        aria-invalid={p.error ? true : undefined}
      >
        <p className="label" id={`${id}-label`}>
          <LabelText {...p} />
        </p>
        {p.hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        )}
        <div className={`cards ${p.className ?? ''}`}>
          {p.options.map((o, i) => {
            const checked = p.value === o.value;
            return (
              <Fragment key={o.value}>
                <label className={`card-choice${checked ? ' is-checked' : ''}`}>
                  <input
                    type="radio"
                    name={p.name}
                    value={o.value}
                    checked={checked}
                    onChange={() => {
                      p.onChange(o.value);
                      setPulse(o.value);
                    }}
                  />
                  {o.icon && <span className="card-icon">{o.icon}</span>}
                  <span className="card-text">
                    <b>{o.label}</b>
                    {o.sub && <small>{o.sub}</small>}
                  </span>
                  <span className="card-dot" aria-hidden="true" />
                  {pulse === o.value && checked && <Burst key={o.value} />}
                </label>
                {checked && p.detail && <Unfold side={i % 2 ? 'right' : 'left'}>{p.detail}</Unfold>}
              </Fragment>
            );
          })}
        </div>
        {p.children}
      </div>
      <FieldError id={id} error={p.error} />
    </div>
  );
}

interface PillChoiceProps extends LabelProps {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  error?: string;
  /** Equal-width segments in one row, for a few short options (e.g. Female / Male / Prefer not to say). */
  segmented?: boolean;
  /** Shown under the pills, e.g. a "Please specify" box when "Other" is picked. */
  children?: ReactNode;
}

/** Single-choice pills (radio group) — compact, for short answer lists such as age ranges. */
function PillChoiceImpl(p: PillChoiceProps) {
  const id = fieldId(p.name);
  const [pulse, setPulse] = useState('');
  return (
    <div className={`field${p.error ? ' has-error' : ''}`}>
      <div
        role="radiogroup"
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-describedby={[p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined}
        aria-required={p.required}
        aria-invalid={p.error ? true : undefined}
      >
        <p className="label" id={`${id}-label`}>
          <LabelText {...p} />
        </p>
        {p.hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        )}
        <div
          className={`chips chips-pills${p.segmented ? ' chips-seg' : p.options.some((o) => o.label.length > 20) ? ' chips-long' : ''}`}
        >
          {p.options.map((o) => {
            const checked = p.value === o.value;
            return (
              <label key={o.value} className={`chip chip-radio${checked ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name={p.name}
                  value={o.value}
                  checked={checked}
                  onChange={() => {
                    p.onChange(o.value);
                    setPulse(o.value);
                  }}
                />
                <span className="chip-dot" aria-hidden="true" />
                <span className="chip-text">{o.label}</span>
                {pulse === o.value && checked && <Burst key={o.value} />}
              </label>
            );
          })}
        </div>
        {p.children}
      </div>
      <FieldError id={id} error={p.error} />
    </div>
  );
}

interface SelectFieldProps extends LabelProps {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  children?: ReactNode;
}

/** Dropdown, for longer single-choice lists (sectors, industries). */
function SelectFieldImpl(p: SelectFieldProps) {
  const id = fieldId(p.name);
  const describedBy = [p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${p.error ? ' has-error' : ''}${p.value ? ' is-filled' : ''}`}>
      <label htmlFor={id} className="label">
        <LabelText {...p} />
      </label>
      {p.hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {p.hint}
        </p>
      )}
      <div className={`control control-select${p.value ? '' : ' is-empty'}`}>
        <select
          id={id}
          name={p.name}
          value={p.value}
          required={p.required}
          aria-invalid={p.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => p.onChange(e.target.value)}
        >
          <option value="" disabled>
            {p.placeholder ?? 'Choose one'}
          </option>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select-chevron" aria-hidden="true">
          <ChevronDown width={18} height={18} />
        </span>
        <span className="control-glow" aria-hidden="true" />
      </div>
      {p.children}
      <FieldError id={id} error={p.error} />
    </div>
  );
}

interface YearsFieldProps extends LabelProps {
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

/** Whole number of years: type it, or use − / + (or the arrow keys). Starts empty, not at 0. */
function YearsFieldImpl(p: YearsFieldProps) {
  const id = fieldId(p.name);
  const n = p.value === '' ? null : Number(p.value);
  const describedBy = [p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  // From empty, + gives 1 and − gives 0.
  const step = (d: 1 | -1) => p.onChange(String(Math.min(YEARS_MAX, Math.max(0, (n ?? (d > 0 ? 0 : 1)) + d))));
  return (
    <div className={`field${p.error ? ' has-error' : ''}${p.value ? ' is-filled' : ''}`}>
      <label htmlFor={id} className="label">
        <LabelText {...p} />
      </label>
      {p.hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {p.hint}
        </p>
      )}
      <div className="stepper">
        <button
          type="button"
          className="stepper-btn"
          aria-label="One year less"
          aria-controls={id}
          tabIndex={-1}
          disabled={n === 0}
          onClick={() => step(-1)}
        >
          <Minus width={18} height={18} />
        </button>
        <div className="control stepper-control">
          <input
            id={id}
            name={p.name}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={2}
            placeholder="–"
            required={p.required}
            role="spinbutton"
            aria-valuemin={0}
            aria-valuemax={YEARS_MAX}
            aria-valuenow={n ?? undefined}
            aria-invalid={p.error ? true : undefined}
            aria-describedby={describedBy}
            value={p.value}
            onChange={(e) => p.onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                step(e.key === 'ArrowUp' ? 1 : -1);
              }
            }}
          />
          <span className="control-glow" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="stepper-btn"
          aria-label="One year more"
          aria-controls={id}
          tabIndex={-1}
          disabled={n !== null && n >= YEARS_MAX}
          onClick={() => step(1)}
        >
          <Plus width={18} height={18} />
        </button>
        <span className="stepper-unit" aria-hidden="true">
          {n === 1 ? 'year' : 'years'}
        </span>
      </div>
      <FieldError id={id} error={p.error} />
    </div>
  );
}

interface ChipChoiceProps extends LabelProps {
  name: string;
  values: string[];
  options: readonly { value: string; label: string }[];
  onChange: (v: string[]) => void;
  error?: string;
  children?: ReactNode;
}

/** Multiple-choice chips (check all that apply). */
function ChipChoiceImpl(p: ChipChoiceProps) {
  const id = fieldId(p.name);
  const [pulse, setPulse] = useState('');
  const toggle = (v: string) => {
    const on = !p.values.includes(v);
    p.onChange(on ? [...p.values, v] : p.values.filter((x) => x !== v));
    setPulse(on ? v : '');
  };
  return (
    <div className={`field${p.error ? ' has-error' : ''}`}>
      <fieldset
        id={id}
        tabIndex={-1}
        className="chip-set"
        aria-describedby={[p.hint && `${id}-hint`, p.error && `${id}-err`].filter(Boolean).join(' ') || undefined}
      >
        <legend className="label">
          <LabelText {...p} />
        </legend>
        {p.hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        )}
        <div className="chips">
          {p.options.map((o) => {
            const checked = p.values.includes(o.value);
            return (
              <label key={o.value} className={`chip${checked ? ' is-checked' : ''}`}>
                <input type="checkbox" name={p.name} value={o.value} checked={checked} onChange={() => toggle(o.value)} />
                <span className="chip-box" aria-hidden="true">
                  <Check width={14} height={14} />
                </span>
                <span className="chip-text">{o.label}</span>
                {pulse === o.value && checked && <Burst key={o.value} />}
              </label>
            );
          })}
        </div>
        {p.children}
      </fieldset>
      <FieldError id={id} error={p.error} />
    </div>
  );
}

// Memoized so typing in one field re-renders only that field, not the whole form — the form
// passes stable callbacks and option lists, so unchanged fields skip rendering entirely.
// (Noticeable on slower phones, where re-rendering every field per keystroke caused jank.)
export const TextField = memo(TextFieldImpl);
export const CardChoice = memo(CardChoiceImpl);
export const PillChoice = memo(PillChoiceImpl);
export const SelectField = memo(SelectFieldImpl);
export const YearsField = memo(YearsFieldImpl);
export const ChipChoice = memo(ChipChoiceImpl);
