import { NextResponse } from 'next/server';
import { findById } from '@/lib/airtable';
import { isAuthenticated } from '@/lib/auth';
import { previewTicketEmail, siteUrl, ticketDataFrom } from '@/lib/email/send';
import type { TicketEmailData } from '@/lib/email/template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAMPLE: TicketEmailData = {
  ref: 'TM241-FC-7KQ2MX',
  name: 'Juan dela Cruz',
  email: 'juan.delacruz@up.edu.ph',
  organization: 'UP Diliman',
  affiliation: 'Graduate Student',
  question: 'What was the hardest capability to build first, and how did you know it was the right one?',
};

/**
 * The confirmation email as a web page, for organizers: /api/email/preview shows it with sample
 * details, /api/email/preview?id=rec… with a real registrant's. Dashboard sign-in required.
 */
export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Sign in to the dashboard first.' }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get('id');
  let data = SAMPLE;
  if (id) {
    const reg = await findById(id).catch(() => null);
    if (!reg) return NextResponse.json({ message: 'Registration not found.' }, { status: 404 });
    data = ticketDataFrom(reg);
  }
  const { subject, html } = await previewTicketEmail(data, siteUrl(req));
  // Show the subject line above the email, the way a mail app would.
  const banner = `<div style="font:13px/1.5 system-ui,sans-serif;color:#b8c3e6;background:#0d1140;padding:10px 16px;border-bottom:1px solid #2b3a78">
    <b style="color:#fff">Email preview</b>${id ? '' : ' (sample details)'} &middot; Subject: ${subject.replace(/</g, '&lt;')}</div>`;
  return new NextResponse(html.replace(/<body([^>]*)>/, `<body$1>${banner}`), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Self-contained page: inline styles and images only; the fonts are the email's own.
      'Content-Security-Policy':
        "default-src 'none'; img-src data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none'",
    },
  });
}
