import { NextResponse } from 'next/server';
import { AirtableError, ConfigError, listRegistrations, markNewTimeEmail } from '@/lib/airtable';
import { BATCH, planAnnouncement, summarize } from '@/lib/announce';
import { isAuthenticated, sameOrigin } from '@/lib/auth';
import {
  describeEmailError,
  emailConfigured,
  EmailNotConfigured,
  sendTicketEmail,
  siteUrl,
  stopsSending,
  ticketDataFrom,
} from '@/lib/email/send';
import { NEW_TIME } from '@/lib/email/template';
import type { Registration } from '@/lib/types';
import { zoomJoinUrl } from '@/lib/zoom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });

function failure(e: unknown) {
  if (e instanceof ConfigError || e instanceof AirtableError) {
    console.error('[email/announce] Airtable:', e.message);
    return reply({ message: 'Could not reach the registrations in Airtable. Try again.' }, 502);
  }
  console.error('[email/announce]', describeEmailError(e));
  return reply({ message: describeEmailError(e) }, 502);
}

/** Dashboard: how many people the "new time" announcement would go to. Sends nothing. */
export async function GET() {
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);
  try {
    return reply({ summary: summarize(planAnnouncement(await listRegistrations())) });
  } catch (e) {
    return failure(e);
  }
}

/**
 * Dashboard: sends the next few announcements, after the organizer confirmed the number of people.
 *   { confirm: 'SEND', expected: n }  the next people who have not had it, if exactly n are left
 *   { confirm: 'SEND', ids: [...] }   try these again: only ones that failed or were never confirmed
 * Each person is marked "Sending" before and "Sent" after, so nobody gets it twice, even if the page
 * is closed or two organizers press the button.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ message: 'Forbidden.' }, 403);
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown; expected?: unknown; ids?: unknown };
  if (body.confirm !== 'SEND') return reply({ message: 'Please confirm first.' }, 400);
  if (!emailConfigured()) return reply({ message: new EmailNotConfigured().message }, 503);

  try {
    const plan = planAnnouncement(await listRegistrations());
    let batch: Registration[];
    if (Array.isArray(body.ids)) {
      const ids = body.ids;
      batch = [...plan.failed, ...plan.unconfirmed].filter((r) => ids.includes(r.id)).slice(0, BATCH);
    } else {
      if (body.expected !== plan.pending.length) {
        return reply({ message: 'The number of people changed. Check it and confirm again.', summary: summarize(plan) }, 409);
      }
      batch = plan.pending.slice(0, BATCH);
    }
    if (!batch.length) return reply({ sent: 0, failed: 0, summary: summarize(plan) });
    if (batch.some((r) => r.attendanceMode === 'Online') && !zoomJoinUrl()) {
      return reply({ message: 'ZOOM_JOIN_URL is missing, so online registrants would not get their link.' }, 503);
    }

    const url = siteUrl(req);
    let sent = 0;
    let failed = 0;
    let stopped: string | undefined;
    await markNewTimeEmail(batch.map((r) => r.id), 'Sending');
    for (const [i, r] of batch.entries()) {
      try {
        await sendTicketEmail(ticketDataFrom(r), { siteUrl: url, notice: NEW_TIME });
      } catch (e) {
        if (!stopsSending(e)) {
          console.error(`[email/announce] ${r.ref}: ${describeEmailError(e)}`);
          failed += 1;
          await markNewTimeEmail([r.id], 'Failed');
          continue;
        }
        // The account itself can't send right now: put this person and the rest back in line.
        stopped = describeEmailError(e);
        console.error(`[email/announce] stopped at ${r.ref}: ${stopped}`);
        await markNewTimeEmail(batch.slice(i).map((x) => x.id), null);
        break;
      }
      sent += 1;
      await markNewTimeEmail([r.id], 'Sent');
      console.info(`[email/announce] sent to ${r.ref}`);
    }
    return reply({ sent, failed, stopped, summary: summarize(planAnnouncement(await listRegistrations())) });
  } catch (e) {
    return failure(e);
  }
}
