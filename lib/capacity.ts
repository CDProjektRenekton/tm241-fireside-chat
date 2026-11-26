// Onsite seats (EVENT.onsiteSeats). Counted per person: each email address once, by its latest
// registration, so someone who registered twice holds one seat. Online has no limit.
import { attendanceModeOf, EVENT } from './config';
import { duplicateKey } from './stats';
import type { Registration } from './types';

export interface OnsiteSeats {
  taken: number;
  max: number;
  left: number;
  full: boolean;
}

export const ONSITE_FULL_MESSAGE = `Onsite is full: all ${EVENT.onsiteSeats} seats are taken. You can still join live on Zoom: choose Online.`;

/** The latest registration of each person (email address; one without an address counts alone). */
function people(rows: Registration[]) {
  const latest = new Map<string, Registration>();
  for (const r of rows) {
    const key = duplicateKey(r) || r.id;
    const seen = latest.get(key);
    if (!seen || Date.parse(r.submittedAt) > Date.parse(seen.submittedAt)) latest.set(key, r);
  }
  return [...latest.values()];
}

export function onsiteSeats(rows: Registration[]): OnsiteSeats {
  const max = EVENT.onsiteSeats;
  const taken = people(rows).filter((r) => attendanceModeOf(r) === 'Onsite').length;
  return { taken, max, left: Math.max(0, max - taken), full: taken >= max };
}

/** Whether this address already holds an onsite seat (registering again doesn't take another). */
export function holdsOnsiteSeat(rows: Registration[], email: string) {
  const key = email.trim().toLowerCase();
  const mine = people(rows).find((r) => duplicateKey(r) === key);
  return Boolean(key && mine && attendanceModeOf(mine) === 'Onsite');
}
