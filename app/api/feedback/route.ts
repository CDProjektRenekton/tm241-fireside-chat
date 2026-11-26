import { createFeedback } from '@/lib/airtable';
import { FB } from '@/lib/fields';
import { attendanceModeOf } from '@/lib/config';
import { FACILITATION, normalizeFeedback, parseWho, SESSIONS, validateFeedback } from '@/lib/feedback';
import {
  access,
  certificateFile,
  CLOSED_MESSAGE,
  failure,
  feedbackOf,
  findPerson,
  makeCertificateNumber,
  NOT_FOUND_MESSAGE,
  queueCertificateEmail,
  reply,
} from '@/lib/feedback-server';
import { maskEmail } from '@/lib/ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Saves an answered feedback form, makes the Certificate of Participation and emails it. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 20_000) return reply({ message: 'Request too large.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ message: 'Invalid request.' }, 400);
  }
  const d = normalizeFeedback(body);
  // Honeypot filled in → almost certainly a bot. Pretend it worked and store nothing.
  if (d.website) return reply({ ok: true, number: makeCertificateNumber(), name: d.name, email: null });

  const errors = validateFeedback(d);
  if (Object.keys(errors).length) return reply({ message: 'Please check the highlighted answers.', errors }, 400);

  try {
    const mode = await access();
    if (mode === 'closed') return reply({ message: CLOSED_MESSAGE, closed: true }, 403);

    if (mode === 'preview') {
      // An organizer trying the form before it opens: nothing is saved, and only an address they typed gets the sample.
      const sample = { name: d.name, number: 'FC-COP-SAMPLE' };
      const { pdf, file } = await certificateFile(sample);
      const who = parseWho(d.who);
      const email = who?.by === 'email' ? who.value : '';
      const emailed = queueCertificateEmail({ ...sample, email }, pdf, req);
      return reply({ ok: true, preview: true, ...sample, email: emailed ? maskEmail(email) : null, file });
    }

    const person = await findPerson(d.who);
    if (!person) return reply({ message: NOT_FOUND_MESSAGE, errors: { who: NOT_FOUND_MESSAGE } }, 404);
    const before = await feedbackOf(person);
    if (before) return reply({ message: 'You already sent your feedback.', answered: true, email: maskEmail(before.email), by: person.by }, 409);

    const { reg } = person;
    const number = makeCertificateNumber();
    const fields: Record<string, unknown> = {
      [FB.number]: number,
      [FB.submittedAt]: new Date().toISOString(),
      [FB.ref]: reg.ref,
      [FB.name]: d.name,
      [FB.registeredName]: reg.name,
      [FB.email]: reg.email,
      [FB.mode]: attendanceModeOf(reg),
      [FB.checkedIn]: reg.attended,
      [FB.satisfied]: Number(d.satisfied),
      [FB.relevant]: Number(d.relevant),
      [FB.takeaways]: d.takeaways,
      ...Object.fromEntries(FACILITATION.map((r) => [FB[r.key], d[r.key]])),
      [FB.facilitationNotes]: d.facilitationNotes,
      ...Object.fromEntries(SESSIONS.map((r) => [FB[r.key], d[r.key]])),
      [FB.overall]: Number(d.overall),
      [FB.overallFeedback]: d.overallFeedback,
      [FB.consent]: 'Yes',
    };
    for (const k of Object.keys(fields)) {
      const v = fields[k];
      if (v === '' || (Array.isArray(v) && v.length === 0)) delete fields[k];
    }
    // Made first, so nobody's answers are saved without a certificate to hand over.
    const { pdf, file } = await certificateFile({ name: d.name, number });
    const saved = await createFeedback(fields);
    const emailed = queueCertificateEmail({ name: d.name, email: reg.email, number }, pdf, req, saved.id);
    return reply({ ok: true, number, name: d.name, email: emailed ? maskEmail(reg.email) : null, file });
  } catch (e) {
    return failure('feedback', e);
  }
}
