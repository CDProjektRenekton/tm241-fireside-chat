import { NextResponse } from 'next/server';
import {
  createSessionToken,
  dashboardConfigured,
  deskPasswordSet,
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
    // Until CHECKIN_PASSWORD is added in Vercel, only the dashboard password opens the desk — say so,
    // instead of leaving a volunteer to think they mistyped. (/api/health already shows whether it is set.)
    const message =
      body.area === 'checkin' && !deskPasswordSet()
        ? 'Incorrect password. No separate desk password is set up on this site yet — sign in with the dashboard password, or add CHECKIN_PASSWORD in Vercel and redeploy.'
        : 'Incorrect password.';
    return NextResponse.json({ message }, { status: 401 });
  }

  // The desk password only opens the check-in desk, so send a volunteer who used it on /dashboard there.
  const next = role === 'desk' && body.area !== 'checkin' ? '/checkin' : undefined;
  const res = NextResponse.json({ ok: true, role, next });
  res.cookies.set(SESSION_COOKIE, createSessionToken(role), sessionCookieOptions);
  return res;
}
