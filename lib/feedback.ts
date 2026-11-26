// The feedback form: its questions, rules and opening time. Shared by the form (instant feedback) and
// the server (the authority). Finishing it gives the Certificate of Participation.
// Part 2 follows the "Leading from the Start Event Evaluation" Google Form, question by question.
import { EVENT } from './config';
import { properName } from './names';
import { parseRef } from './ticket';
import type { FieldErrors } from './types';
import { clean, cleanLong, isEmail, LIMITS, MSG } from './validation';

/** Opens by itself when the event starts. Signed-in organizers can always open it to try it. */
export const FEEDBACK_OPENS_AT = EVENT.startsAt;
export const feedbackIsOpen = (now = Date.now()) => now >= Date.parse(FEEDBACK_OPENS_AT);

/** Questions 1 and 2: 1 "Not" to 5 "Very much". */
export const NOT_TO_VERY_MUCH = ['Not', 'Very much'] as const;

/** Question 4: each part of the event, 1 (very dissatisfied) to 5 (very satisfied), or N/A. */
export const FACILITATION = [
  { key: 'venue', text: 'Venue' },
  { key: 'registration', text: 'Registration and Communication' },
  { key: 'publicity', text: 'Publicity Materials' },
  { key: 'content', text: 'Session Content' },
  { key: 'timeliness', text: 'Program Timeliness' },
  { key: 'food', text: 'Food and Refreshments' },
] as const;
export type FacilitationKey = (typeof FACILITATION)[number]['key'];
export const FACILITATION_VALUES = ['1', '2', '3', '4', '5', 'N/A'] as const;

/** Question 6: each session, from not relevant to very relevant (or did not attend). */
export const SESSIONS = [
  { key: 'session1', text: 'Session 1: Building National Technological Capabilities' },
  { key: 'session2', text: 'Session 2: Strengthening Research and National Innovation' },
] as const;
export type SessionKey = (typeof SESSIONS)[number]['key'];
export const SESSION_VALUES = ['Not relevant', 'Relevant', 'Very relevant', 'Did not attend'] as const;

/** Questions 4 and 7: what 1 and 5 mean. */
export const DISSATISFIED_TO_SATISFIED = '1 = Very dissatisfied, 5 = Very satisfied';

export interface FeedbackInput extends Record<FacilitationKey, string>, Record<SessionKey, string> {
  /** The email they registered with, or their reference number. */
  who: string;
  /** As it should be printed on the certificate. */
  name: string;
  /** 1. How satisfied were you with the event? (1–5) */
  satisfied: string;
  /** 2. How relevant and helpful do you think it was for your role or field? (1–5) */
  relevant: string;
  /** 3. What were your key takeaways from the fireside chat? */
  takeaways: string;
  /** 5. Tell us more about your feedback above! */
  facilitationNotes: string;
  /** 7. How satisfied were you with the overall fireside chat? (1–5 stars) */
  overall: string;
  /** 8. Any overall feedback for the event? (optional) */
  overallFeedback: string;
  consent: 'Yes' | 'No' | '';
  /** Honeypot — real people never fill this in. */
  website?: string;
}

export const EMPTY_FEEDBACK: FeedbackInput = {
  who: '',
  name: '',
  satisfied: '',
  relevant: '',
  takeaways: '',
  venue: '',
  registration: '',
  publicity: '',
  content: '',
  timeliness: '',
  food: '',
  facilitationNotes: '',
  session1: '',
  session2: '',
  overall: '',
  overallFeedback: '',
  consent: '',
  website: '',
};

export const NAME_MAX = 70;

const FMSG = {
  who: 'Please enter the email you registered with, or your reference number.',
  name: 'Please use letters A to Z (accents like Ñ and É are fine), so it can be printed.',
  rate: 'Please choose a rating.',
  rows: 'Please answer every row.',
};

/** Letters (with accents), digits, spaces and the punctuation names use. */
const PRINTABLE_NAME = /^[\p{Script=Latin}\p{M}\d .,'’‘“”"()\-–]+$/u;
const HAS_LETTER = /\p{Script=Latin}/u;

/** "email" or "ref", and the cleaned-up value; null when it is neither. */
export function parseWho(raw: string): { by: 'email' | 'ref'; value: string } | null {
  const v = raw.trim();
  if (isEmail(v)) return { by: 'email', value: v.toLowerCase() };
  const ref = v.includes('@') ? null : parseRef(v);
  return ref ? { by: 'ref', value: ref } : null;
}

const oneToFive = (v: string) => /^[1-5]$/.test(v);
const longText = (v: string, required: boolean) => (required && !v.trim() ? MSG.required : v.length > LIMITS.long ? MSG.tooLong : '');

export function validateFeedback1(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (!d.who.trim()) e.who = MSG.required;
  else if (!parseWho(d.who)) e.who = FMSG.who;
  const name = d.name.trim();
  if (!name) e.name = MSG.required;
  else if (name.length > NAME_MAX) e.name = MSG.tooLong;
  else if (!PRINTABLE_NAME.test(name) || !HAS_LETTER.test(name)) e.name = FMSG.name;
  return e;
}

export function validateFeedback2(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (!oneToFive(d.satisfied)) e.satisfied = FMSG.rate;
  if (!oneToFive(d.relevant)) e.relevant = FMSG.rate;
  const takeaways = longText(d.takeaways, true);
  if (takeaways) e.takeaways = takeaways;
  if (FACILITATION.some((r) => !FACILITATION_VALUES.includes(d[r.key] as never))) e.facilitation = FMSG.rows;
  const notes = longText(d.facilitationNotes, true);
  if (notes) e.facilitationNotes = notes;
  if (SESSIONS.some((r) => !SESSION_VALUES.includes(d[r.key] as never))) e.sessions = FMSG.rows;
  if (!oneToFive(d.overall)) e.overall = FMSG.rate;
  const more = longText(d.overallFeedback, false);
  if (more) e.overallFeedback = more;
  return e;
}

export function validateFeedback3(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (d.consent !== 'Yes') e.consent = d.consent === 'No' ? 'Your consent is required to receive the certificate.' : MSG.choose;
  return e;
}

export const FEEDBACK_VALIDATORS = [validateFeedback1, validateFeedback2, validateFeedback3] as const;

export const validateFeedback = (d: FeedbackInput): FieldErrors => ({ ...validateFeedback1(d), ...validateFeedback2(d), ...validateFeedback3(d) });

/** Which stage (1–3) a field key belongs to, so the form can jump back to it. */
export function feedbackStageOf(key: string): 1 | 2 | 3 {
  if (key === 'who' || key === 'name') return 1;
  if (key === 'consent') return 3;
  return 2;
}

/** Coerce an untrusted request body into a FeedbackInput with trimmed strings. */
export function normalizeFeedback(body: unknown): FeedbackInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const pick = (k: string, max = 20) => clean(b[k], max);
  return {
    who: clean(b.who, 254),
    name: properName(clean(b.name, NAME_MAX)),
    satisfied: pick('satisfied', 2),
    relevant: pick('relevant', 2),
    takeaways: cleanLong(b.takeaways),
    ...(Object.fromEntries(FACILITATION.map((r) => [r.key, pick(r.key)])) as Record<FacilitationKey, string>),
    facilitationNotes: cleanLong(b.facilitationNotes),
    ...(Object.fromEntries(SESSIONS.map((r) => [r.key, pick(r.key)])) as Record<SessionKey, string>),
    overall: pick('overall', 2),
    overallFeedback: cleanLong(b.overallFeedback),
    consent: clean(b.consent) as FeedbackInput['consent'],
    website: clean(b.website),
  };
}
