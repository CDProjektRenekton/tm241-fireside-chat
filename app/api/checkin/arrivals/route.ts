import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, listRegistrations } from '@/lib/airtable';
import { isAuthenticated } from '@/lib/auth';
import { attendanceModeOf } from '@/lib/config';
import { affiliationLabel } from '@/lib/stats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * The live arrivals page (/dashboard/checkins): everyone who registered and whether they have been
 * checked in at the door. Dashboard password only. Read-only; the page asks again every few seconds.
 */
export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ message: 'Not signed in.' }, { status: 401, headers: noStore });
  try {
    const rows = await listRegistrations();
    const people = rows.map((r) => ({
      id: r.id,
      ref: r.ref,
      name: r.name,
      organization: r.organization,
      affiliation: affiliationLabel(r),
      mode: attendanceModeOf(r),
      attended: r.attended,
      checkedInAt: r.checkedInAt,
    }));
    return NextResponse.json({ people, fetchedAt: new Date().toISOString() }, { headers: noStore });
  } catch (e) {
    console.error('[checkin/arrivals]', e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e);
    const message = e instanceof ConfigError ? 'Airtable is not connected.' : e instanceof AirtableError && e.status === 429 ? 'Airtable is busy; trying again shortly.' : 'Could not reach Airtable.';
    return NextResponse.json({ message }, { status: 502, headers: noStore });
  }
}
