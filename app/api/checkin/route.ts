import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, findById, findByRef, listRegistrations, setAttendance } from '@/lib/airtable';
import { canCheckIn, sameOrigin } from '@/lib/auth';
import { affiliationLabel } from '@/lib/stats';
import { maskEmail, parseRef } from '@/lib/ticket';
import type { CheckInResult, DeskRecord, Registration } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });

/** Only what the person at the door needs to greet the registrant and spot a borrowed ticket. */
const toDesk = (r: Registration, withEmail = false): DeskRecord => ({
  id: r.id,
  ref: r.ref,
  name: r.name,
  organization: r.organization,
  affiliation: affiliationLabel(r),
  attended: r.attended,
  checkedInAt: r.checkedInAt,
  ...(withEmail ? { email: maskEmail(r.email) } : {}),
});

function failure(e: unknown) {
  console.error('[checkin]', e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e);
  const message =
    e instanceof ConfigError
      ? 'Airtable is not connected (AIRTABLE_TOKEN is missing in this deployment).'
      : e instanceof AirtableError
        ? e.status === 429
          ? 'Airtable is receiving too many requests. Wait about 30 seconds, then scan again.'
          : e.type === 'INVALID_VALUE_FOR_COLUMN'
            ? 'The “Attended” column in Airtable must be a checkbox.'
            : `Airtable: ${e.message}`
        : 'Could not reach the registration database. Check the internet connection and try again.';
  return json({ message }, 502);
}

/** Head count for the desk, plus a name/email search for registrants who lost their ticket (?q=). */
export async function GET(req: Request) {
  if (!(await canCheckIn())) return json({ message: 'Not signed in.' }, 401);
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  try {
    const rows = await listRegistrations();
    const body: { total: number; attended: number; matches?: DeskRecord[] } = {
      total: rows.length,
      attended: rows.filter((r) => r.attended).length,
    };
    if (q.length >= 2) {
      const words = q.split(/\s+/);
      body.matches = rows
        .filter((r) => {
          const hay = `${r.name} ${r.email} ${r.organization} ${r.ref}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        .slice(0, 8)
        .map((r) => toDesk(r, true));
    }
    return json(body);
  } catch (e) {
    return failure(e);
  }
}

/**
 * Verifies a ticket against Airtable and, unless only verifying, marks it "Attended".
 * Body: { code } (what the scanner read or the desk typed) or { id } (a name-search result),
 * plus action "checkin" (default), "verify" (look only) or "undo".
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ message: 'Forbidden.' }, 403);
  if (!(await canCheckIn())) return json({ message: 'Not signed in.' }, 401);

  const body = (await req.json().catch(() => ({}))) as { code?: unknown; id?: unknown; action?: unknown };
  const action = body.action === 'verify' || body.action === 'undo' ? body.action : 'checkin';
  const code = typeof body.code === 'string' ? body.code.slice(0, 500) : '';
  const id = typeof body.id === 'string' ? body.id : '';

  try {
    let ref: string | null = null;
    let reg: Registration | null;
    if (id) {
      reg = await findById(id);
    } else {
      ref = parseRef(code);
      if (!ref) return json({ result: 'invalid' satisfies CheckInResult });
      reg = await findByRef(ref);
    }
    if (!reg) return json({ result: 'not-found' satisfies CheckInResult, ref });

    let result: CheckInResult;
    if (action === 'verify') {
      result = reg.attended ? 'already' : 'valid';
    } else if (action === 'undo') {
      if (reg.attended) reg = await setAttendance(reg.id, false);
      result = 'undone';
    } else if (reg.attended) {
      result = 'already';
    } else {
      reg = await setAttendance(reg.id, true);
      result = 'checked-in';
    }
    return json({ result, ref: reg.ref || ref, record: toDesk(reg) });
  } catch (e) {
    return failure(e);
  }
}
