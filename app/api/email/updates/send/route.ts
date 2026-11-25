import { getUpdate, listRegistrations, saveEmailLogs, setUpdateStatus } from '@/lib/airtable';
import { describeEmailError, emailConfigured, EmailNotConfigured, sendUpdateEmail, siteUrl, stopsSending, ticketDataFrom } from '@/lib/email/send';
import type { Registration } from '@/lib/types';
import { planUpdate, summarizeUpdate, UPDATE_BATCH, validateUpdate, withLogState, type DeliveryState } from '@/lib/updates';
import { failure, refuse, reply } from '@/lib/updates-server';
import { zoomJoinUrl } from '@/lib/zoom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Emails the next few people of an update's audience, after the organizer confirmed the number.
 *   { id, confirm: 'SEND', expected: n }  the next people who have not had it, if exactly n are left
 *   { id, confirm: 'SEND', ids: [...] }   try these again: only ones that failed or were never confirmed
 * Uses the saved words, never the browser's. Each person is written down as "Sending" before and
 * "Sent" after, so nobody gets an update twice, even if the page closes or two organizers press send.
 */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; confirm?: unknown; expected?: unknown; ids?: unknown };
  if (body.confirm !== 'SEND') return reply({ message: 'Please confirm first.' }, 400);
  if (!emailConfigured()) return reply({ message: new EmailNotConfigured().message }, 503);

  try {
    const update = typeof body.id === 'string' ? await getUpdate(body.id) : null;
    if (!update || update.status === 'Discarded') return reply({ message: 'This update no longer exists.' }, 404);
    const errors = validateUpdate(update);
    if (Object.keys(errors).length) return reply({ message: 'Please finish the update first.', errors }, 400);

    const rows = await listRegistrations();
    // Two updates at once could overwrite each other's notes of who got what.
    const other = rows.map((r) => r.emailLog.match(/(UPD-[A-Z0-9]+) Sending/g) ?? []).flat().find((m) => !m.startsWith(`${update.code} `));
    if (other) {
      return reply({ message: `Another update (${other.split(' ')[0]}) is still going out. Let it finish, or use "Try again" on it first.` }, 409);
    }

    const plan = planUpdate(rows, update);
    let batch: Registration[];
    if (Array.isArray(body.ids)) {
      const ids = body.ids;
      batch = [...plan.failed, ...plan.unconfirmed].filter((r) => ids.includes(r.id)).slice(0, UPDATE_BATCH);
    } else {
      if (body.expected !== plan.pending.length) {
        return reply({ message: 'The number of people changed. Check it and confirm again.', summary: summarizeUpdate(plan) }, 409);
      }
      batch = plan.pending.slice(0, UPDATE_BATCH);
    }
    if (!batch.length) return reply({ sent: 0, failed: 0, summary: summarizeUpdate(plan) });
    if (update.includePass && batch.some((r) => r.attendanceMode === 'Online') && !zoomJoinUrl()) {
      return reply({ message: 'ZOOM_JOIN_URL is missing, so online registrants would not get their link.' }, 503);
    }

    const note = (list: Registration[], state: (r: Registration) => DeliveryState | null) =>
      saveEmailLogs(list.map((r) => ({ id: r.id, log: withLogState(r.emailLog, update.code, state(r)) })));

    if (update.status === 'Draft') await setUpdateStatus(update.id, 'Sending', { sentAt: new Date().toISOString() });
    await note(batch, () => 'Sending');

    const url = siteUrl(req);
    const result = new Map<string, DeliveryState | null>();
    let stopped: string | undefined;
    try {
      for (const r of batch) {
        try {
          await sendUpdateEmail(update, ticketDataFrom(r), { siteUrl: url });
          result.set(r.id, 'Sent');
          console.info(`[email/updates] ${update.code} sent to ${r.ref}`);
        } catch (e) {
          if (stopsSending(e)) {
            // The account itself can't send right now: this person and the rest go back in line.
            stopped = describeEmailError(e);
            console.error(`[email/updates] ${update.code} stopped at ${r.ref}: ${stopped}`);
            break;
          }
          result.set(r.id, 'Failed');
          console.error(`[email/updates] ${update.code} ${r.ref}: ${describeEmailError(e)}`);
        }
      }
    } finally {
      await note(batch, (r) => result.get(r.id) ?? null);
    }

    const after = planUpdate(await listRegistrations(), update);
    const finished = !after.pending.length && !after.unconfirmed.length;
    await setUpdateStatus(update.id, finished || update.status === 'Sent' ? 'Sent' : 'Sending', { people: after.sent });
    const states = [...result.values()];
    return reply({
      sent: states.filter((s) => s === 'Sent').length,
      failed: states.filter((s) => s === 'Failed').length,
      stopped,
      summary: summarizeUpdate(after),
    });
  } catch (e) {
    return failure('email/updates/send', e);
  }
}
