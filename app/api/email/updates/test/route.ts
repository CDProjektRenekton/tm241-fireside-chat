import { sendUpdateEmail, siteUrl } from '@/lib/email/send';
import { normalizeUpdate, validateUpdate } from '@/lib/updates';
import { failure, refuse, reply, sampleRegistrant } from '@/lib/updates-server';
import { isEmail } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sends the update, filled in with a made-up registrant, to ONE typed address so an organizer can see
 * the real email first. Never reads or emails registrants.
 */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as { content?: unknown; to?: unknown; version?: unknown };
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!isEmail(to)) return reply({ message: 'Please enter a valid email address.' }, 400);
  const content = normalizeUpdate(body.content);
  const errors = validateUpdate(content);
  if (Object.keys(errors).length) return reply({ message: 'Please finish the update first.', errors }, 400);
  const versions: ('Onsite' | 'Online')[] = body.version === 'Onsite' || body.version === 'Online' ? [body.version] : ['Onsite', 'Online'];

  const sent: string[] = [];
  try {
    for (const mode of versions) {
      await sendUpdateEmail(content, sampleRegistrant(mode, to), { siteUrl: siteUrl(req) });
      sent.push(mode);
      console.info(`[email/updates] ${mode} test sent`);
    }
    return reply({ ok: true, to, sent });
  } catch (e) {
    return failure('email/updates/test', e);
  }
}
