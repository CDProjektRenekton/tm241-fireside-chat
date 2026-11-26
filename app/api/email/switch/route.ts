import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, findById, setAttendanceMode } from '@/lib/airtable';
import { isAuthenticated, sameOrigin } from '@/lib/auth';
import { ATTENDANCE_MODES, attendanceModeOf } from '@/lib/config';
import { describeEmailError, sendModeSwitchEmail, siteUrl, ticketDataFrom } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * Dashboard: moves a registrant between onsite and online. { id, mode, notify } changes "Attendance Mode"
 * and, with notify, emails them the change with their new boarding pass (QR code onsite, Join on Zoom
 * online). { id, resend: true } sends that email again for the way they are joining now.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ message: 'Forbidden.' }, 403);
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; mode?: unknown; notify?: unknown; resend?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  const resend = body.resend === true;

  let registration;
  try {
    const reg = await findById(id);
    if (!reg) return reply({ message: 'Registration not found.' }, 404);
    registration = reg;
    if (!resend) {
      const mode = ATTENDANCE_MODES.find((m) => m === body.mode);
      if (!mode) return reply({ message: 'Choose Onsite or Online.' }, 400);
      if (attendanceModeOf(reg) === mode) return reply({ message: `${reg.name || 'This registrant'} is already ${mode.toLowerCase()}.`, registration: reg }, 409);
      registration = await setAttendanceMode(reg.id, mode);
      console.log(`[email/switch] ${reg.ref} moved to ${mode}`);
    }
  } catch (e) {
    if (e instanceof ConfigError || e instanceof AirtableError) {
      console.error('[email/switch] Airtable:', e.message);
      return reply({ message: 'Could not update Airtable. Nothing was changed; try again.' }, 502);
    }
    throw e;
  }

  if (!resend && body.notify !== true) return reply({ ok: true, registration, email: 'Skipped' });
  if (!registration.email) return reply({ ok: true, registration, email: 'Failed', message: 'This registration has no email address.' }, resend ? 400 : 200);
  try {
    await sendModeSwitchEmail(ticketDataFrom(registration), { siteUrl: siteUrl(req) });
    console.log(`[email/switch] ${registration.ref} emailed (${attendanceModeOf(registration)})`);
    return reply({ ok: true, registration, email: 'Sent', to: registration.email });
  } catch (e) {
    const message = describeEmailError(e);
    console.error(`[email/switch] ${registration.ref} not emailed:`, message);
    // The move itself stands; the page offers to try the email again.
    return reply({ ok: !resend, registration, email: 'Failed', message }, resend ? 502 : 200);
  }
}
