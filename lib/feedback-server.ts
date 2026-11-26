import 'server-only';
import { randomInt } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { AirtableError, ConfigError, findFeedback, listRegistrations, setCertificateEmail, type FeedbackRecord } from './airtable';
import { buildCertificate, certificateFileName } from './certificate';
import { describeEmailError, emailConfigured, sendCertificateEmail, siteUrl } from './email/send';
import { parseWho } from './feedback';
import { REF_ALPHABET } from './ticket';
import type { Registration } from './types';

/** Shared by the /api/feedback routes. */

export const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function failure(where: string, e: unknown) {
  console.error(`[${where}]`, e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e instanceof ConfigError ? e.message : e);
  return reply({ message: 'Something went wrong on our side. Please try again.' }, 502);
}

export const NOT_FOUND_MESSAGE =
  'We couldn’t find a registration with this. Check the spelling, try the other one (email or reference number), or ask the registration desk.';

export interface Person {
  /** The registration used: the one that was checked in, otherwise the latest. */
  reg: Registration;
  /** Found by the reference number, which only they (and the organizers) have. */
  by: 'email' | 'ref';
  refs: string[];
}

export async function findPerson(who: string): Promise<Person | null> {
  const w = parseWho(who);
  if (!w) return null;
  const rows = await listRegistrations(); // newest first
  const address = (r: Registration) => r.email.trim().toLowerCase();
  if (w.by === 'ref') {
    const reg = rows.find((r) => r.ref.toUpperCase() === w.value);
    if (!reg) return null;
    const same = address(reg) ? rows.filter((r) => address(r) === address(reg)) : [reg];
    return { reg, by: 'ref', refs: same.map((r) => r.ref) };
  }
  const mine = rows.filter((r) => address(r) === w.value);
  if (!mine.length) return null;
  return { reg: mine.find((r) => r.attended) ?? mine[0], by: 'email', refs: mine.map((r) => r.ref) };
}

export const feedbackOf = (p: Person) => findFeedback(p.refs.filter(Boolean), p.reg.email);

export function makeCertificateNumber() {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `FC-COP-${s}`;
}

export async function certificateFile(f: { name: string; number: string }) {
  const pdf = await buildCertificate(f);
  return { pdf, file: { name: certificateFileName(f.name), base64: pdf.toString('base64') } };
}

/**
 * Emails the certificate once the response has gone back, so nobody waits on the mail server and a mail
 * problem never loses the answers. Returns whether an email was queued.
 */
export function queueCertificateEmail(f: Pick<FeedbackRecord, 'name' | 'email' | 'number'>, pdf: Buffer, req: Request, recordId?: string) {
  if (!emailConfigured() || !f.email) {
    if (recordId) after(() => setCertificateEmail(recordId, 'Not set up').catch(() => {}));
    return false;
  }
  const url = siteUrl(req);
  after(async () => {
    const note = (state: 'Sent' | 'Failed') => (recordId ? setCertificateEmail(recordId, state).catch((e) => console.error('[feedback] could not note the email:', e)) : undefined);
    try {
      await sendCertificateEmail(f, pdf, { siteUrl: url });
      console.info(`[feedback] certificate ${f.number} sent`);
      await note('Sent');
    } catch (e) {
      console.error(`[feedback] certificate ${f.number} could not be sent:`, describeEmailError(e));
      await note('Failed');
    }
  });
  return true;
}
