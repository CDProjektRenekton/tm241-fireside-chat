import { setCertificateEmail } from '@/lib/airtable';
import { certificateFile, failure, feedbackOf, findPerson, NOT_FOUND_MESSAGE, queueCertificateEmail, reply } from '@/lib/feedback-server';
import { maskEmail } from '@/lib/ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WAIT_MS = 10 * 60_000;

/**
 * Someone who already answered wants their certificate again. It is emailed to the registered address
 * (at most every ten minutes); with their reference number they can also download it here.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { who?: unknown };
  try {
    const person = await findPerson(typeof body.who === 'string' ? body.who.slice(0, 254) : '');
    if (!person) return reply({ message: NOT_FOUND_MESSAGE }, 404);
    const done = await feedbackOf(person);
    if (!done) return reply({ message: 'Please answer the feedback form first.' }, 404);

    const { pdf, file } = await certificateFile(done);
    const recently = done.certEmailAt && Date.now() - Date.parse(done.certEmailAt) < WAIT_MS && done.certEmail !== 'Failed';
    let emailed = false;
    if (!recently) {
      await setCertificateEmail(done.id, 'Sending');
      emailed = queueCertificateEmail(done, pdf, req, done.id);
    }
    return reply({
      ok: true,
      number: done.number,
      email: emailed ? maskEmail(done.email) : null,
      ...(recently ? { recently: maskEmail(done.email) } : {}),
      ...(person.by === 'ref' ? { name: done.name, file } : {}),
    });
  } catch (e) {
    return failure('feedback/again', e);
  }
}
