// The feedback form: its questions, rules and opening time. Shared by the form (instant feedback) and
// the server (the authority). Finishing it gives the Certificate of Participation.
import { ATTENDANCE_MODES, EVENT, TOPICS, type AttendanceMode } from './config';
import { parseRef } from './ticket';
import type { FieldErrors } from './types';
import { clean, cleanLong, isEmail, LIMITS, MSG } from './validation';

/** Opens by itself when the event starts. Signed-in organizers can always open it to try it. */
export const FEEDBACK_OPENS_AT = EVENT.startsAt;
export const feedbackIsOpen = (now = Date.now()) => now >= Date.parse(FEEDBACK_OPENS_AT);

/** 1 (lowest) to 5 (highest). */
export const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;
export const AGREE_LABELS = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] as const;

/** Statements rated from "Strongly disagree" to "Strongly agree". The last one depends on how they joined. */
export const STATEMENTS = [
  { key: 'relevance', text: () => 'The topic was relevant to my studies or work.' },
  { key: 'speaker', text: () => 'The guest speaker explained ideas clearly and kept me engaged.' },
  { key: 'learning', text: () => 'I learned something I can use.' },
  { key: 'discussion', text: () => 'The conversation and open questions were meaningful.' },
  { key: 'organization', text: () => 'The event was well organized, from registration to closing.' },
  {
    key: 'setting',
    text: (mode: string) =>
      mode === 'Online' ? 'The Zoom session was easy to join, with clear audio and video.' : 'The venue was comfortable and easy to reach.',
  },
] as const;
export type StatementKey = (typeof STATEMENTS)[number]['key'];

/** 0 (not at all likely) to 10 (extremely likely). */
export const RECOMMEND_MAX = 10;

export interface FeedbackInput extends Record<StatementKey, string> {
  /** The email they registered with, or their reference number. */
  who: string;
  /** As it should be printed on the certificate. */
  name: string;
  mode: AttendanceMode | '';
  overall: string;
  recommend: string;
  takeaway: string;
  improve: string;
  topics: string[];
  topicsOther: string;
  /** May organizers share their comments without their name? */
  share: 'Yes' | 'No' | '';
  consent: 'Yes' | 'No' | '';
  /** Honeypot — real people never fill this in. */
  website?: string;
}

export const EMPTY_FEEDBACK: FeedbackInput = {
  who: '',
  name: '',
  mode: '',
  overall: '',
  relevance: '',
  speaker: '',
  learning: '',
  discussion: '',
  organization: '',
  setting: '',
  recommend: '',
  takeaway: '',
  improve: '',
  topics: [],
  topicsOther: '',
  share: '',
  consent: '',
  website: '',
};

export const NAME_MAX = 70;

const FMSG = {
  who: 'Please enter the email you registered with, or your reference number.',
  name: 'Please use letters A to Z (accents like Ñ and É are fine), so it can be printed.',
  rate: 'Please choose a rating.',
  rateAll: 'Please rate every statement.',
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

const inRange = (v: string, min: number, max: number) => /^\d{1,2}$/.test(v) && Number(v) >= min && Number(v) <= max;

export function validateFeedback1(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (!d.who.trim()) e.who = MSG.required;
  else if (!parseWho(d.who)) e.who = FMSG.who;
  const name = d.name.trim();
  if (!name) e.name = MSG.required;
  else if (name.length > NAME_MAX) e.name = MSG.tooLong;
  else if (!PRINTABLE_NAME.test(name) || !HAS_LETTER.test(name)) e.name = FMSG.name;
  if (!ATTENDANCE_MODES.includes(d.mode as never)) e.mode = MSG.choose;
  return e;
}

export function validateFeedback2(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (!inRange(d.overall, 1, 5)) e.overall = FMSG.rate;
  if (STATEMENTS.some((s) => !inRange(d[s.key], 1, 5))) e.statements = FMSG.rateAll;
  if (!inRange(d.recommend, 0, RECOMMEND_MAX)) e.recommend = FMSG.rate;
  return e;
}

export function validateFeedback3(d: FeedbackInput): FieldErrors {
  const e: FieldErrors = {};
  if (!d.takeaway.trim()) e.takeaway = MSG.required;
  else if (d.takeaway.length > LIMITS.long) e.takeaway = MSG.tooLong;
  if (d.improve.length > LIMITS.long) e.improve = MSG.tooLong;
  if (d.topics.some((t) => !TOPICS.includes(t as never))) e.topics = MSG.choose;
  if (d.topics.includes('Other')) {
    if (!d.topicsOther.trim()) e.topicsOther = MSG.other;
    else if (d.topicsOther.length > LIMITS.short) e.topicsOther = MSG.tooLong;
  }
  if (d.share && d.share !== 'Yes' && d.share !== 'No') e.share = MSG.choose;
  if (d.consent !== 'Yes') e.consent = d.consent === 'No' ? 'Your consent is required to receive the certificate.' : MSG.choose;
  return e;
}

export const FEEDBACK_VALIDATORS = [validateFeedback1, validateFeedback2, validateFeedback3] as const;

export const validateFeedback = (d: FeedbackInput): FieldErrors => ({ ...validateFeedback1(d), ...validateFeedback2(d), ...validateFeedback3(d) });

/** Which stage (1–3) a field key belongs to, so the form can jump back to it. */
export function feedbackStageOf(key: string): 1 | 2 | 3 {
  if (['who', 'name', 'mode'].includes(key)) return 1;
  if (['overall', 'statements', 'recommend'].includes(key)) return 2;
  return 3;
}

/** Coerce an untrusted request body into a FeedbackInput with trimmed strings. */
export function normalizeFeedback(body: unknown): FeedbackInput {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const chosen = Array.isArray(b.topics) ? [...new Set(b.topics.slice(0, TOPICS.length + 2).map((t) => clean(t)))].filter(Boolean) : [];
  return {
    who: clean(b.who, 254),
    name: clean(b.name, NAME_MAX),
    mode: clean(b.mode) as FeedbackInput['mode'],
    overall: clean(b.overall, 2),
    relevance: clean(b.relevance, 2),
    speaker: clean(b.speaker, 2),
    learning: clean(b.learning, 2),
    discussion: clean(b.discussion, 2),
    organization: clean(b.organization, 2),
    setting: clean(b.setting, 2),
    recommend: clean(b.recommend, 2),
    takeaway: cleanLong(b.takeaway),
    improve: cleanLong(b.improve),
    topics: [...TOPICS.filter((t) => chosen.includes(t)), ...chosen.filter((t) => !TOPICS.includes(t as never))],
    topicsOther: chosen.includes('Other') ? clean(b.topicsOther) : '',
    share: clean(b.share) as FeedbackInput['share'],
    consent: clean(b.consent) as FeedbackInput['consent'],
    website: clean(b.website),
  };
}
