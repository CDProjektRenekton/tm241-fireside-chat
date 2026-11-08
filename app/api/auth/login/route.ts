import { NextResponse } from 'next/server';
import {
  createSessionToken,
  dashboardConfigured,
  roleForPassword,
  sameOrigin,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });
  if (!dashboardConfigured()) {
    return NextResponse.json(
      { message: 'The dashboard password is not set. Add DASHBOARD_PASSWORD in Vercel environment variables.' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown; area?: unknown };
  const password = typeof body.password === 'string' ? body.password : '';
  const role = roleForPassword(password);

  if (!role) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ message: 'Incorrect password.' }, { status: 401 });
  }

  // The desk password only opens the check-in desk, so send a volunteer who used it on /dashboard there.
  const next = role === 'desk' && body.area !== 'checkin' ? '/checkin' : undefined;
  const res = NextResponse.json({ ok: true, role, next });
  res.cookies.set(SESSION_COOKIE, createSessionToken(role), sessionCookieOptions);
  return res;
}
