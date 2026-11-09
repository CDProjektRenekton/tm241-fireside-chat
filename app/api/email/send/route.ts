import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, findById } from '@/lib/airtable';
import { isAuthenticated, sameOrigin } from '@/lib/auth';
import { describeEmailError, EmailNotConfigured, sendTicketEmail, siteUrl, ticketDataFrom } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** Dashboard: (re)send a registrant's boarding-pass email — e.g. when they say it never arrived. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403, headers: noStore });
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Not signed in.' }, { status: 401, headers: noStore });
  }
  const body = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';

  try {
    const reg = await findById(id);
    if (!reg) return NextResponse.json({ message: 'Registration not found.' }, { status: 404, headers: noStore });
    if (!reg.email) return NextResponse.json({ message: 'This registration has no email address.' }, { status: 400, headers: noStore });
    await sendTicketEmail(ticketDataFrom(reg), { siteUrl: siteUrl(req) });
    return NextResponse.json({ ok: true, to: reg.email }, { headers: noStore });
  } catch (e) {
    if (e instanceof ConfigError || e instanceof AirtableError) {
      console.error('[email/send] Airtable:', e.message);
      return NextResponse.json({ message: 'Could not look up the registration. Try again.' }, { status: 502, headers: noStore });
    }
    const message = describeEmailError(e);
    console.error('[email/send]', message);
    return NextResponse.json({ message }, { status: e instanceof EmailNotConfigured ? 503 : 502, headers: noStore });
  }
}
