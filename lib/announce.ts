// Who gets the "new time" announcement, worked out from the registrations and what was already sent.
import { attendanceModeOf } from './config';
import { duplicateKey } from './stats';
import type { Registration } from './types';
import { isEmail } from './validation';

/** When the new time went live: registrations from then on were already told 1:00 PM. */
export const NEW_TIME_LIVE_AT = '2026-11-25T15:48:00+08:00';

/** People per request, so one request stays well inside the server's time limit. */
export const BATCH = 8;

export interface AnnouncePlan {
  /** Not sent yet: one registration (the latest) per email address, oldest first. */
  pending: Registration[];
  /** The mail server refused the address. */
  failed: Registration[];
  /** Sending started but was never confirmed (e.g. the connection dropped): may or may not have arrived. */
  unconfirmed: Registration[];
  sent: number;
  /** Registered after the new time went live, so there is nothing to tell them. */
  alreadyToldNewTime: number;
  noEmail: number;
  /** Extra registrations with an address that is already counted. */
  merged: number;
}

export function planAnnouncement(rows: Registration[]): AnnouncePlan {
  const plan: AnnouncePlan = { pending: [], failed: [], unconfirmed: [], sent: 0, alreadyToldNewTime: 0, noEmail: 0, merged: 0 };
  const byAddress = new Map<string, Registration[]>();
  for (const r of rows) {
    if (!isEmail(r.email.trim())) {
      plan.noEmail += 1;
      continue;
    }
    const k = duplicateKey(r);
    byAddress.set(k, [...(byAddress.get(k) ?? []), r]);
  }
  for (const group of byAddress.values()) {
    const [latest] = [...group].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
    plan.merged += group.length - 1;
    if (group.some((r) => r.newTimeEmail === 'Sent')) plan.sent += 1;
    else if (group.some((r) => r.newTimeEmail === 'Sending')) plan.unconfirmed.push(latest);
    else if (group.some((r) => r.newTimeEmail === 'Failed')) plan.failed.push(latest);
    else if (Date.parse(latest.submittedAt) >= Date.parse(NEW_TIME_LIVE_AT)) plan.alreadyToldNewTime += 1;
    else plan.pending.push(latest);
  }
  plan.pending.sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt));
  return plan;
}

/** What the dashboard shows: counts, plus the references it may retry. No names or addresses. */
export interface AnnounceSummary {
  pending: number;
  pendingOnsite: number;
  pendingOnline: number;
  sent: number;
  failed: { id: string; ref: string }[];
  unconfirmed: { id: string; ref: string }[];
  alreadyToldNewTime: number;
  noEmail: number;
  merged: number;
}

export function summarize(plan: AnnouncePlan): AnnounceSummary {
  const online = plan.pending.filter((r) => attendanceModeOf(r) === 'Online').length;
  const refs = (list: Registration[]) => list.map((r) => ({ id: r.id, ref: r.ref }));
  return {
    pending: plan.pending.length,
    pendingOnsite: plan.pending.length - online,
    pendingOnline: online,
    sent: plan.sent,
    failed: refs(plan.failed),
    unconfirmed: refs(plan.unconfirmed),
    alreadyToldNewTime: plan.alreadyToldNewTime,
    noEmail: plan.noEmail,
    merged: plan.merged,
  };
}
