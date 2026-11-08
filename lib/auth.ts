import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'tm241_dashboard';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export function dashboardConfigured() {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

function secret() {
  return (
    process.env.SESSION_SECRET ||
    createHash('sha256')
      .update(`tm241-dashboard:${process.env.DASHBOARD_PASSWORD ?? ''}:${process.env.AIRTABLE_TOKEN ?? ''}`)
      .digest('hex')
  );
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Two kinds of sign-in:
 * - "admin" (DASHBOARD_PASSWORD): the dashboard, exports and the check-in desk.
 * - "desk" (CHECKIN_PASSWORD, optional): only the check-in desk at /checkin, for volunteers at the door.
 *   It can look up a ticket and mark attendance, but never sees emails, answers or exports.
 */
export type Role = 'admin' | 'desk';

export function deskPasswordSet() {
  return Boolean(passwordFor('desk'));
}

// Tolerates stray spaces or quotes pasted into Vercel along with the value.
const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '').trim() || undefined;
const passwordFor = (role: Role) => clean(role === 'admin' ? process.env.DASHBOARD_PASSWORD : process.env.CHECKIN_PASSWORD);

/** Which sign-in a password unlocks, or null if it matches neither. */
export function roleForPassword(raw: string): Role | null {
  // Copying a password out of a file or chat often brings a space or line break along.
  const input = raw.trim();
  if (!input) return null;
  for (const role of ['admin', 'desk'] as const) {
    const expected = passwordFor(role);
    if (expected && safeEqual(input, expected)) return role;
  }
  return null;
}

// The signature also covers the role's current password, so changing a password signs out
// everyone who used the old one.
const signSession = (exp: string, role: Role) => sign(`${exp}.${role}.${passwordFor(role) ?? ''}`);

export function createSessionToken(role: Role) {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE);
  return `${exp}.${role}.${signSession(exp, role)}`;
}

export function verifySessionToken(token: string | undefined): Role | null {
  if (!token || !dashboardConfigured()) return null;
  const [exp, role, sig, extra] = token.split('.');
  if (extra !== undefined || (role !== 'admin' && role !== 'desk') || !exp || !sig) return null;
  if (!passwordFor(role) || !safeEqual(sig, signSession(exp, role))) return null;
  return Number(exp) * 1000 > Date.now() ? role : null;
}

export async function sessionRole() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Dashboard, responses, exports and schema setup. */
export async function isAuthenticated() {
  return (await sessionRole()) === 'admin';
}

/** The check-in desk: either password works. */
export async function canCheckIn() {
  return (await sessionRole()) !== null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE,
};

/** Rejects cross-site POSTs to admin endpoints. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
