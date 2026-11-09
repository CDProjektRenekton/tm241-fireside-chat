import { NextResponse } from 'next/server';
import { connectionStatus } from '@/lib/airtable';
import { dashboardConfigured, deskPasswordSet } from '@/lib/auth';
import { emailStatus } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Setup check: open /api/health on the deployed site to see whether Airtable and the
 * dashboard are configured. Never returns secret values.
 */
export async function GET() {
  const airtable = await connectionStatus();
  const dashboardPassword = dashboardConfigured();
  const ok = airtable.ok && dashboardPassword;
  return NextResponse.json(
    {
      ok,
      deployment: process.env.VERCEL_ENV ?? 'local',
      airtable: {
        connected: airtable.ok,
        tokenVariable: airtable.tokenVariable,
        base: airtable.usingDefaultBase ? 'Fireside Chat (TM241) base (built-in default)' : 'from AIRTABLE_BASE_ID',
        ...(airtable.problem ? { problem: airtable.problem } : {}),
      },
      dashboard: {
        passwordSet: dashboardPassword,
        ...(dashboardPassword ? {} : { problem: 'DASHBOARD_PASSWORD is missing — the dashboard cannot be opened.' }),
      },
      checkin: {
        // Optional: without it, the check-in desk (/checkin) opens with the dashboard password only.
        deskPasswordSet: deskPasswordSet(),
      },
      // Optional: without it, registrants get their boarding pass on screen only, not by email.
      email: emailStatus(),
    },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
