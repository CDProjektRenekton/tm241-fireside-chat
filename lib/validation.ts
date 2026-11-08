// Shared by the form (instant feedback) and /api/submit (the authority).
import { AFFILIATIONS, TOPICS } from './config';
import type { FieldErrors, RegistrationInput } from './types';

export const MSG = {
  required: 'This field is required.',
  choose: 'Please choose an option.',
  email: 'Please enter a valid email address.',
  other: 'Please tell us what “Other” means for you.',
  consent: 'Your consent is required to complete the registration.',
  tooLong: 'This answer is too long.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const LIMITS = { short: 150, name: 120, long: 1000 };

/** Collapses whitespace for one-line answers. */
export function clean(v: unknown, max = LIMITS.short): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max + 1) : '';
}

/** Keeps line breaks for paragraph answers, trims the rest. */
export function cleanLong(v: unknown, max = LIMITS.long): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max + 1);
}

export function isEmail(v: string) {
  return EMAIL_RE.test(v) && v.length <= 254;
}

function text(errors: FieldErrors, key: string, value: string, max = LIMITS.short) {
  if (!value) errors[key] = MSG.required;
  else if (value.length > max) errors[key] = MSG.tooLong;
}

/** Step 1 — About you. */
export function validateStep1(d: RegistrationInput): FieldErrors {
  const e: FieldErrors = {};
  text(e, 'name', d.name, LIMITS.name);
  if (!d.email) e.email = MSG.required;
  else if (!isEmail(d.email)) e.email = MSG.email;
  text(e, 'organization', d.organization);
  if (!AFFILIATIONS.includes(d.affiliation as never)) e.affiliation = MSG.choose;
  else if (d.affiliation === 'Other') {
    if (!d.affiliationOther) e.affiliationOther = MSG.other;
    else if (d.affiliationOther.length > LIMITS.short) e.affiliationOther = MSG.tooLong;
  }
  return e;
}

/** Step 2 — Audience engagement (all optional, but "Other" needs a description). */
export function validateStep2(d: RegistrationInput): FieldErrors {
  const e: FieldErrors = {};
  if (d.topics.some((t) => !TOPICS.includes(t as never))) e.topics = MSG.choose;
  if (d.topics.includes('Other')) {
    if (!d.topicsOther) e.topicsOther = MSG.other;
    else if (d.topicsOther.length > LIMITS.short) e.topicsOther = MSG.tooLong;
  }
  if (d.question.length > LIMITS.long) e.question = MSG.tooLong;
  if (d.hopes.length > LIMITS.long) e.hopes = MSG.tooLong;
  return e;
}

/** Step 3 — Consent. */
export function validateStep3(d: RegistrationInput): FieldErrors {
  if (d.consent === 'Yes') return {};
  return { consent: d.consent === 'No' ? MSG.consent : MSG.choose };
}

export const STEP_VALIDATORS = [validateStep1, validateStep2, validateStep3] as const;

export function validateAll(d: RegistrationInput): FieldErrors {
  return { ...validateStep1(d), ...validateStep2(d), ...validateStep3(d) };
}

/** Which step (1–3) a field key belongs to, so the form can jump back to it. */
export function stepOf(key: string): 1 | 2 | 3 {
  if (['topics', 'topicsOther', 'question', 'hopes'].includes(key)) return 2;
  if (key === 'consent') return 3;
  return 1;
}

/** Coerce an untrusted request body into a RegistrationInput with trimmed strings. */
export function normalizeInput(body: unknown): RegistrationInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const topics = Array.isArray(b.topics)
    ? [...new Set(b.topics.slice(0, TOPICS.length + 2).map((t) => clean(t)))].filter(Boolean)
    : [];
  const affiliation = clean(b.affiliation) as RegistrationInput['affiliation'];
  return {
    name: clean(b.name, LIMITS.name),
    email: clean(b.email).toLowerCase(),
    organization: clean(b.organization),
    affiliation,
    affiliationOther: affiliation === 'Other' ? clean(b.affiliationOther) : '',
    // Keep the official order so Airtable and exports list topics consistently.
    // Unknown values are kept so validation can reject them.
    topics: [...TOPICS.filter((t) => topics.includes(t)), ...topics.filter((t) => !TOPICS.includes(t as never))],
    topicsOther: topics.includes('Other') ? clean(b.topicsOther) : '',
    question: cleanLong(b.question),
    hopes: cleanLong(b.hopes),
    consent: clean(b.consent) as RegistrationInput['consent'],
    website: clean(b.website),
  };
}
