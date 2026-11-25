import { attendanceModeOf } from '@/lib/config';
import { parseWho } from '@/lib/feedback';
import { access, CLOSED_MESSAGE, failure, feedbackOf, findPerson, NOT_FOUND_MESSAGE, reply } from '@/lib/feedback-server';
import { maskEmail } from '@/lib/ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is this someone who registered, and have they answered already? Only a reference number (which just
 * they and the organizers have) brings back the registered name and how they said they'd join.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { who?: unknown };
  const who = typeof body.who === 'string' ? body.who.slice(0, 254) : '';
  if (!parseWho(who)) return reply({ message: 'Please enter the email you registered with, or your reference number.' }, 400);
  try {
    const mode = await access();
    if (mode === 'closed') return reply({ message: CLOSED_MESSAGE, closed: true }, 403);
    if (mode === 'preview') return reply({ ok: true, preview: true });
    const person = await findPerson(who);
    if (!person) return reply({ message: NOT_FOUND_MESSAGE, notFound: true }, 404);
    const answered = await feedbackOf(person);
    return reply({
      ok: true,
      answered: Boolean(answered),
      ...(answered ? { email: maskEmail(answered.email || person.reg.email), by: person.by } : {}),
      ...(person.by === 'ref' ? { name: person.reg.name, mode: attendanceModeOf(person.reg) } : {}),
    });
  } catch (e) {
    return failure('feedback/check', e);
  }
}
