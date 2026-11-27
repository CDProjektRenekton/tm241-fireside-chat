import { getCertificateSettings, listFeedback, setCertificateEmail } from '@/lib/airtable';
import { buildCertificate } from '@/lib/certificate';
import { counts, failure, refuse, reply, toSend } from '@/lib/certificates-server';
import { describeEmailError, emailConfigured, sendCertificateEmail, siteUrl, stopsSending } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** People per request, so one request stays well inside the server's time limit; the page repeats it. */
const BATCH = 6;

/**
 * Makes and emails the certificates of people who answered while automatic certificates were off,
 * a few at a time, with the signatures as they are now. { retry: true } also tries the failed ones.
 * The page asks for a confirmation before the first request.
 */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  if (!emailConfigured()) return reply({ message: 'Email is not set up on this site, so certificates cannot be sent.' }, 503);
  const body = (await req.json().catch(() => ({}))) as { retry?: unknown };
  const retry = body.retry === true;

  try {
    const [settings, rows] = await Promise.all([getCertificateSettings(), listFeedback()]);
    const queue = toSend(rows, retry);
    const batch = queue.slice(0, BATCH);
    const url = siteUrl(req);
    let sent = 0;
    let failed = 0;
    let stopped = '';
    for (const f of batch) {
      const before = f.certEmail;
      await setCertificateEmail(f.id, 'Sending');
      try {
        const pdf = await buildCertificate({ name: f.name, number: f.number, signatures: settings.signatures });
        await sendCertificateEmail({ name: f.name, email: f.email, number: f.number }, pdf, { siteUrl: url });
        await setCertificateEmail(f.id, 'Sent');
        sent += 1;
      } catch (e) {
        const why = describeEmailError(e);
        if (stopsSending(e)) {
          // The mail account can't send right now (e.g. Gmail's daily limit): leave them as they were.
          await setCertificateEmail(f.id, before === 'Waiting' ? 'Waiting' : 'Failed').catch(() => {});
          stopped = why;
          break;
        }
        console.error(`[certificates] ${f.number} not sent:`, why);
        await setCertificateEmail(f.id, 'Failed').catch(() => {});
        failed += 1;
      }
    }
    console.info(`[certificates] sent ${sent}, failed ${failed}${stopped ? `, stopped: ${stopped}` : ''}`);
    const after = await listFeedback();
    return reply({ sent, failed, stopped, left: toSend(after, retry).length, counts: counts(after) });
  } catch (e) {
    return failure('certificates/send', e);
  }
}
