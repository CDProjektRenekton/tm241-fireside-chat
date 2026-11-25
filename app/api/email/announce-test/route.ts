import { NextResponse } from 'next/server';
import { isAuthenticated, sameOrigin } from '@/lib/auth';
import { describeEmailError, EmailNotConfigured, sendTicketEmail, siteUrl } from '@/lib/email/send';
import { NEW_TIME, type TicketEmailData } from '@/lib/email/template';
import { isEmail } from '@/lib/validation';
import { zoomJoinUrl } from '@/lib/zoom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });

/**
 * Dashboard: sends the "new time" announcement to ONE address, filled in with sample details, so the
 * organizers can see the real email before anyone else gets it. Never reads or emails registrants.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ message: 'Forbidden.' }, 403);
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);

  const body = (await req.json().catch(() => ({}))) as { to?: unknown; version?: unknown };
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!isEmail(to)) return reply({ message: 'Please enter a valid email address.' }, 400);
  const versions =
    body.version === 'onsite' ? (['Onsite'] as const) : body.version === 'online' ? (['Online'] as const) : (['Onsite', 'Online'] as const);

  const sent: string[] = [];
  try {
    for (const attendanceMode of versions) {
      const sample: TicketEmailData = {
        // Not a real registration: the desk will say "Not registered" if this QR code is scanned.
        ref: `TM241-FC-${attendanceMode === 'Online' ? 'TESTZM' : 'TESTQR'}`,
        name: 'Test Registrant',
        email: to,
        organization: 'UP Diliman',
        affiliation: 'Graduate Student',
        attendanceMode,
        joinUrl: attendanceMode === 'Online' ? zoomJoinUrl() : null,
      };
      await sendTicketEmail(sample, { siteUrl: siteUrl(req), notice: NEW_TIME });
      sent.push(attendanceMode);
      console.info(`[email/announce-test] ${attendanceMode} sample sent`);
    }
    return reply({ ok: true, to, sent });
  } catch (e) {
    const message = describeEmailError(e);
    console.error('[email/announce-test]', message);
    return reply({ message, sent }, e instanceof EmailNotConfigured ? 503 : 502);
  }
}
