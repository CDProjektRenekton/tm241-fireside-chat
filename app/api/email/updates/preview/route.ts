import { previewUpdateEmail, siteUrl } from '@/lib/email/send';
import { normalizeUpdate } from '@/lib/updates';
import { refuse, reply, sampleRegistrant } from '@/lib/updates-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The email as it would look, filled in with a made-up registrant. Emails nobody. */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as { content?: unknown; mode?: unknown };
  const { subject, html } = previewUpdateEmail(
    normalizeUpdate(body.content),
    sampleRegistrant(body.mode === 'Online' ? 'Online' : 'Onsite', 'registrant@example.com'),
    { siteUrl: siteUrl(req), origin: new URL(req.url).origin },
  );
  return reply({ subject, html });
}
