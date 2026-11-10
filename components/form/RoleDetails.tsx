'use client';

import type { ReactNode } from 'react';
import type { Affiliation } from '@/lib/config';
import { type DetailKey, type DetailQuestion, ROLE_QUESTIONS } from '@/lib/roles';
import type { FieldErrors, RegistrationInput } from '@/lib/types';
import { PillChoice, SelectField, TextField, YearsField } from './Fields';

// Option lists built once, so the memoized fields see unchanged props.
const OPTIONS = new Map<readonly string[], { value: string; label: string }[]>();
const optionsOf = (q: DetailQuestion) => {
  const list = q.options ?? [];
  if (!OPTIONS.has(list)) OPTIONS.set(list, list.map((o) => ({ value: o, label: o })));
  return OPTIONS.get(list)!;
};

interface Props {
  affiliation: Affiliation;
  icon: ReactNode;
  /** Number of the affiliation question; the follow-ups are numbered 06.1, 06.2… */
  number: number;
  data: RegistrationInput;
  errors: FieldErrors;
  set: (key: DetailKey) => (v: string) => void;
}

/**
 * The follow-up questions for the chosen affiliation, in a panel that opens under the
 * affiliation cards. Re-mounts (and re-plays its entrance) whenever the affiliation changes.
 */
export default function RoleDetails({ affiliation, icon, number, data, errors, set }: Props) {
  const questions = ROLE_QUESTIONS[affiliation];
  if (!questions.length) return null;
  const head = String(number).padStart(2, '0');

  const otherBox = (q: DetailQuestion) =>
    q.otherKey &&
    data[q.key] === 'Other' && (
      <div className="other-box">
        <TextField
          name={q.otherKey}
          label={`${q.label}: other`}
          bare
          autoFocus
          placeholder="Please specify"
          value={data[q.otherKey]}
          onChange={set(q.otherKey)}
          error={errors[q.otherKey]}
        />
      </div>
    );

  return (
    <div className="role-panel" role="group" aria-labelledby="role-panel-title">
      <div className="role-head">
        <span className="role-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <p className="role-kicker">A few more details</p>
          <p className="role-title" id="role-panel-title">
            {affiliation}
          </p>
        </div>
      </div>

      {questions.map((q, i) => {
        const common = {
          name: q.key,
          number: `${head}.${i + 1}`,
          label: q.label,
          hint: q.hint,
          required: true,
          value: data[q.key],
          onChange: set(q.key),
          error: errors[q.key],
        };
        switch (q.kind) {
          case 'text':
            return <TextField key={q.key} {...common} placeholder={q.placeholder} />;
          case 'years':
            return <YearsField key={q.key} {...common} />;
          case 'select':
            return (
              <SelectField key={q.key} {...common} options={optionsOf(q)}>
                {otherBox(q)}
              </SelectField>
            );
          default:
            return (
              <PillChoice key={q.key} {...common} segmented={q.kind === 'segmented'} options={optionsOf(q)}>
                {otherBox(q)}
              </PillChoice>
            );
        }
      })}
    </div>
  );
}
