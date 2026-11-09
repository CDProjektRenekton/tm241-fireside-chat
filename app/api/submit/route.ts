import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, createRegistration } from '@/lib/airtable';
import { EVENT } from '@/lib/config';
import { queueTicketEmail } from '@/lib/email/send';
import { F } from '@/lib/fields';
import { REF_ALPHABET, REF_CODE_LENGTH } from '@/lib/ticket';
import { normalizeInput, validateAll } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeRef() {
  let s = '';
  for (let i = 0; i < REF_CODE_LENGTH; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${EVENT.refPrefix}-${s}`;
}

const fail = (status: number, message: string, extra: object = {}) =>
  NextResponse.json({ ok: false, message, ...extra }, { status });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 20_000) return fail(413, 'Request too large.');

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, 'Invalid request.');
  }

  const input = normalizeInput(body);
  // Honeypot filled in → almost certainly a bot. Pretend it worked and store nothing.
  if (input.website) return NextResponse.json({ ok: true, ref: makeRef() });

  const errors = validateAll(input);
  if (Object.keys(errors).length) {
    return fail(400, 'Please check the highlighted answers.', { errors });
  }

  const ref = makeRef();
  const fields: Record<string, string | string[]> = {
    [F.ref]: ref,
    [F.submittedAt]: new Date().toISOString(),
    [F.name]: input.name,
    [F.email]: input.email,
    [F.organization]: input.organization,
    [F.affiliation]: input.affiliation,
    [F.affiliationOther]: input.affiliationOther,
    [F.topics]: input.topics,
    [F.topicsOther]: input.topicsOther,
    [F.question]: input.question,
    [F.hopes]: input.hopes,
    [F.consent]: 'Yes',
  };
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (v === '' || (Array.isArray(v) && v.length === 0)) delete fields[k];
  }

  try {
    await createRegistration(fields);
    // The boarding pass also goes out by email, after this response (never holds up or fails the registration).
    const emailed = queueTicketEmail(
      {
        ref,
        name: input.name,
        email: input.email,
        organization: input.organization,
        affiliation: input.affiliation === 'Other' ? input.affiliationOther || 'Other' : input.affiliation,
        question: input.question,
      },
      req,
    );
    return NextResponse.json({ ok: true, ref, emailed });
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error('[submit] configuration error:', e.message);
      return fail(503, 'Registration is not open yet — the form is still being configured. Please try again later.');
    }
    console.error('[submit] Airtable error:', e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e);
    return fail(502, 'We could not save your registration. Please try again.');
  }
}
