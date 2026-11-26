import 'server-only';
import { listRegistrations } from './airtable';
import { onsiteSeats, type OnsiteSeats } from './capacity';

// Every visit to the registration form asks whether Onsite is full; a short memory keeps that from
// becoming an Airtable call each time. A registration always counts afresh, then clears the memory.
const KEEP_MS = 15_000;
let kept: { at: number; seats: OnsiteSeats } | null = null;

export async function seatsForForm(): Promise<OnsiteSeats> {
  if (!kept || Date.now() - kept.at > KEEP_MS) kept = { at: Date.now(), seats: onsiteSeats(await listRegistrations()) };
  return kept.seats;
}

/** After a registration or a move between onsite and online. */
export function forgetSeats() {
  kept = null;
}
