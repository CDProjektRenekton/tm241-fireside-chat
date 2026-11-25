import 'server-only';
import { NextResponse } from 'next/server';
import { AirtableError, ConfigError } from './airtable';
import { isAuthenticated, sameOrigin } from './auth';
import { describeEmailError, EmailNotConfigured } from './email/send';
import type { TicketEmailData } from './email/parts';
import { zoomJoinUrl } from './zoom';

/** Shared by the /api/email/updates routes. */

export const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Signed-in organizers only, and only from the site's own pages. Returns the refusal, or null. */
export async function refuse(req: Request, write = true) {
  if (write && !sameOrigin(req)) return reply({ message: 'Forbidden.' }, 403);
  if (!(await isAuthenticated())) return reply({ message: 'Not signed in.' }, 401);
  return null;
}

export function failure(where: string, e: unknown) {
  if (e instanceof ConfigError || e instanceof AirtableError) {
    console.error(`[${where}] Airtable:`, e instanceof AirtableError ? `${e.status} ${e.type}: ${e.message}` : e.message);
    return reply({ message: 'Could not reach Airtable. Try again.' }, 502);
  }
  const message = describeEmailError(e);
  console.error(`[${where}]`, message);
  return reply({ message }, e instanceof EmailNotConfigured ? 503 : 502);
}

/** A made-up registrant for previews and tests. Its QR code is not a real registration. */
export function sampleRegistrant(mode: 'Onsite' | 'Online', email: string): TicketEmailData {
  return {
    ref: `TM241-FC-${mode === 'Online' ? 'TESTZM' : 'TESTQR'}`,
    name: 'Test Registrant',
    email,
    organization: 'UP Diliman',
    affiliation: 'Graduate Student',
    attendanceMode: mode,
    joinUrl: mode === 'Online' ? zoomJoinUrl() : null,
  };
}
