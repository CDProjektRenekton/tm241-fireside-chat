import 'server-only';
import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, getCertificateSettings, listFeedback, type CertificateSettings, type FeedbackRecord } from './airtable';
import { isAuthenticated, sameOrigin } from './auth';
import { emailConfigured } from './email/send';
import { SIGNATORIES } from './signatories';

/** Shared by the /api/certificates routes (dashboard: Certificates). */

export const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Signed-in organizers (dashboard password) only, and only from the site's own pages. Returns the refusal, or null. */
export async function refuse(req: Request, write = true) {
  if (write && !sameOrigin(req)) return reply({ message: 'Forbidden.' }, 403);
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);
  return null;
}

export function failure(where: string, e: unknown) {
  console.error(`[${where}]`, e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e instanceof ConfigError ? e.message : e);
  return reply({ message: e instanceof AirtableError || e instanceof ConfigError ? 'Could not reach Airtable. Try again.' : 'Something went wrong. Try again.' }, 502);
}

/** Sending started more than this long ago and never finished (e.g. the page closed): may be tried again. */
export const STUCK_MS = 10 * 60_000;

export const isStuck = (f: FeedbackRecord, now = Date.now()) => f.certEmail === 'Sending' && (!f.certEmailAt || now - Date.parse(f.certEmailAt) > STUCK_MS);

/** Who the "Send" button would email: everyone waiting, and with retry also the failed and the stuck. */
export const toSend = (rows: FeedbackRecord[], retry: boolean) =>
  rows.filter((f) => f.email && (f.certEmail === 'Waiting' || (retry && (f.certEmail === 'Failed' || f.certEmail === 'Not set up' || isStuck(f)))));

export function counts(rows: FeedbackRecord[]) {
  const n = (test: (f: FeedbackRecord) => boolean) => rows.filter(test).length;
  return {
    answered: rows.length,
    waiting: n((f) => f.certEmail === 'Waiting'),
    sent: n((f) => f.certEmail === 'Sent'),
    failed: n((f) => f.certEmail === 'Failed' || f.certEmail === 'Not set up' || isStuck(f)),
    sending: n((f) => f.certEmail === 'Sending' && !isStuck(f)),
  };
}

/** Everything the Certificates page shows. No names or addresses of the people who answered. */
export async function pageState(settings?: CertificateSettings) {
  const [s, rows] = await Promise.all([settings ?? getCertificateSettings(), listFeedback()]);
  return {
    auto: s.auto,
    updatedAt: s.updatedAt,
    signatories: SIGNATORIES.map((x) => ({ key: x.key, name: x.name, title: x.title, signature: s.signatures[x.key] })),
    counts: counts(rows),
    emailReady: emailConfigured(),
  };
}
