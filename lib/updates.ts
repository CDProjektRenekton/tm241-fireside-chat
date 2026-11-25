// Email updates: what an organizer writes, who it goes to, and who has had it already.
// Shared by the Email updates page (instant feedback) and the server (the authority).
import { attendanceModeOf, EVENT } from './config';
import { duplicateKey } from './stats';
import type { FieldErrors, Registration } from './types';
import { clean, cleanLong, isEmail } from './validation';

/** Who an update goes to. "Checked in" = arrived at the event, e.g. for a thank-you. */
export const AUDIENCES = ['Everyone', 'Onsite', 'Online', 'Checked in'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const UPDATE_STATUSES = ['Draft', 'Sending', 'Sent', 'Discarded'] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

export interface UpdateContent {
  subject: string;
  headline: string;
  /** Paragraphs; "- " bullets, **bold**, links, {name} and {ref}. */
  message: string;
  /** Optional Was/Now box, e.g. a new time or venue. Shown when "now" is filled in. */
  before: string;
  now: string;
  /** Optional button. */
  buttonLabel: string;
  buttonUrl: string;
  audience: Audience;
  /** Their own boarding pass: QR code onsite, Join on Zoom online. */
  includePass: boolean;
  /** Calendar invite attached, with an Add to Google Calendar button. */
  attachInvite: boolean;
}

export interface EmailUpdate extends UpdateContent {
  /** Airtable record. */
  id: string;
  /** e.g. UPD-7KQ2MX; written next to each registration that had it. */
  code: string;
  status: UpdateStatus;
  createdAt: string;
  sentAt: string;
}

export const EMPTY_UPDATE: UpdateContent = {
  subject: '',
  headline: '',
  message: '',
  before: '',
  now: '',
  buttonLabel: '',
  buttonUrl: '',
  audience: 'Everyone',
  includePass: true,
  attachInvite: false,
};

export const UPDATE_LIMITS = { subject: 120, headline: 70, message: 4000, before: 80, now: 80, buttonLabel: 40, buttonUrl: 500 } as const;

const when = `${EVENT.weekday}, ${EVENT.dateEn}`;

/** Starting points; every word can be edited. */
export const PRESETS: { key: string; label: string; content: Partial<UpdateContent> }[] = [
  { key: 'blank', label: 'Blank', content: {} },
  {
    key: 'reminder',
    label: 'Reminder',
    content: {
      subject: `Reminder: ${EVENT.series} on ${when}`,
      headline: 'Almost time for liftoff',
      message: `This is a reminder that the **${EVENT.series}: ${EVENT.title}** is on **${when}**, ${EVENT.time} (Philippine time).\n\nYour boarding pass is below. We look forward to having you with us!`,
      attachInvite: true,
    },
  },
  {
    key: 'change',
    label: 'Change of time or venue',
    content: {
      subject: `Important update about the ${EVENT.series}`,
      headline: 'There has been a change',
      message: `Here is what changed for the **${EVENT.series}** on **${when}**. Your registration still stands, so there's no need to register again.\n\nWe're sorry for the short notice, and we hope you can still join us!`,
      attachInvite: true,
    },
  },
  {
    key: 'zoom',
    label: 'Zoom reminder (online)',
    content: {
      subject: `Joining the ${EVENT.series} online`,
      headline: 'See you online',
      message: `The **${EVENT.series}** is live on Zoom on **${when}**, ${EVENT.time} (Philippine time).\n\n- Use the Join on Zoom button on your boarding pass below.\n- Please join a few minutes early, with your registered name.`,
      audience: 'Online',
      attachInvite: true,
    },
  },
  {
    key: 'thanks',
    label: 'Thank you and feedback',
    content: {
      subject: `Thank you for joining the ${EVENT.series}`,
      headline: 'Thank you for joining us',
      message: `Thank you for being part of the **${EVENT.series}: ${EVENT.title}**. We'd love to hear what you thought; it takes only a few minutes.`,
      buttonLabel: 'Give feedback',
      audience: 'Checked in',
      includePass: false,
    },
  },
];

const text = (v: unknown, max: number) => clean(v, max).slice(0, max);

/** Coerce an untrusted request body into an UpdateContent. */
export function normalizeUpdate(body: unknown): UpdateContent {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    subject: text(b.subject, UPDATE_LIMITS.subject),
    headline: text(b.headline, UPDATE_LIMITS.headline),
    message: cleanLong(b.message, UPDATE_LIMITS.message).slice(0, UPDATE_LIMITS.message),
    before: text(b.before, UPDATE_LIMITS.before),
    now: text(b.now, UPDATE_LIMITS.now),
    buttonLabel: text(b.buttonLabel, UPDATE_LIMITS.buttonLabel),
    buttonUrl: text(b.buttonUrl, UPDATE_LIMITS.buttonUrl),
    audience: AUDIENCES.find((a) => a === b.audience) ?? 'Everyone',
    includePass: b.includePass === true,
    attachInvite: b.attachInvite === true,
  };
}

export function isWebLink(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** What stops an update from being sent (a draft can be saved half-written). */
export function validateUpdate(u: UpdateContent): FieldErrors {
  const e: FieldErrors = {};
  if (!u.subject) e.subject = 'Please write a subject.';
  if (!u.headline) e.headline = 'Please write a headline.';
  if (!u.message) e.message = 'Please write the message.';
  if (u.before && !u.now) e.now = 'Please fill in the new value too, or clear "Was".';
  if (u.buttonLabel && !u.buttonUrl) e.buttonUrl = 'Please add the link this button opens.';
  if (u.buttonUrl && !u.buttonLabel) e.buttonLabel = 'Please write the words on the button.';
  if (u.buttonUrl && !isWebLink(u.buttonUrl)) e.buttonUrl = 'Please enter a full link that starts with https://';
  const unknown = `${u.subject} ${u.headline} ${u.message}`.match(/\{[^{}\n]{1,20}\}/g)?.filter((t) => !/^\{(name|ref)\}$/i.test(t));
  if (unknown?.length) e.message = `${unknown[0]} is not something the email can fill in. Use {name} or {ref}.`;
  return e;
}

// ---------------------------------------------------------------- what each registration has had

export type DeliveryState = 'Sending' | 'Sent' | 'Failed';

const LOG_LINE = /^(UPD-[A-Z0-9]{4,10}) (Sending|Sent|Failed)$/;

/** The "Email Log" column holds one line per update: "UPD-7KQ2MX Sent". */
export function logState(log: string, code: string): DeliveryState | null {
  for (const line of log.split('\n')) {
    const m = line.trim().match(LOG_LINE);
    if (m && m[1] === code) return m[2] as DeliveryState;
  }
  return null;
}

/** The log with this update's line replaced (or removed), everything else left alone. */
export function withLogState(log: string, code: string, state: DeliveryState | null): string {
  const rest = log.split('\n').filter((line) => line.trim() && line.trim().match(LOG_LINE)?.[1] !== code);
  return (state ? [...rest, `${code} ${state}`] : rest).join('\n');
}

export interface UpdatePlan {
  /** Not sent yet: one registration (the latest) per email address, oldest first. */
  pending: Registration[];
  /** The mail server refused the address. */
  failed: Registration[];
  /** Sending started but was never confirmed (e.g. the connection dropped): may or may not have arrived. */
  unconfirmed: Registration[];
  sent: number;
}

/** Everyone with a usable address, as one group of registrations per address, latest first. */
function peopleByAddress(rows: Registration[]) {
  const groups = new Map<string, Registration[]>();
  for (const r of rows) {
    if (!isEmail(r.email.trim())) continue;
    const k = duplicateKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((g) => g.sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)));
}

function inAudience(group: Registration[], audience: Audience) {
  if (audience === 'Everyone') return true;
  if (audience === 'Checked in') return group.some((r) => r.attended);
  return attendanceModeOf(group[0]) === audience;
}

export function planUpdate(rows: Registration[], update: Pick<EmailUpdate, 'code' | 'audience'>): UpdatePlan {
  const plan: UpdatePlan = { pending: [], failed: [], unconfirmed: [], sent: 0 };
  for (const group of peopleByAddress(rows)) {
    const states = group.map((r) => logState(r.emailLog, update.code));
    if (states.includes('Sent')) plan.sent += 1;
    else if (!inAudience(group, update.audience)) continue;
    else if (states.includes('Sending')) plan.unconfirmed.push(group[0]);
    else if (states.includes('Failed')) plan.failed.push(group[0]);
    else plan.pending.push(group[0]);
  }
  plan.pending.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  return plan;
}

/** What the page shows: counts, plus the references it may retry. No names or addresses. */
export interface UpdateSummary {
  pending: number;
  pendingOnsite: number;
  pendingOnline: number;
  sent: number;
  failed: { id: string; ref: string }[];
  unconfirmed: { id: string; ref: string }[];
}

export function summarizeUpdate(plan: UpdatePlan): UpdateSummary {
  const online = plan.pending.filter((r) => attendanceModeOf(r) === 'Online').length;
  const refs = (list: Registration[]) => list.map((r) => ({ id: r.id, ref: r.ref }));
  return {
    pending: plan.pending.length,
    pendingOnsite: plan.pending.length - online,
    pendingOnline: online,
    sent: plan.sent,
    failed: refs(plan.failed),
    unconfirmed: refs(plan.unconfirmed),
  };
}

/** How many people each audience is right now (one per email address). */
export function audienceCounts(rows: Registration[]): Record<Audience, number> {
  const groups = peopleByAddress(rows);
  return Object.fromEntries(AUDIENCES.map((a) => [a, groups.filter((g) => inAudience(g, a)).length])) as Record<Audience, number>;
}

/** People per request, so one request stays well inside the server's time limit. */
export const UPDATE_BATCH = 8;
