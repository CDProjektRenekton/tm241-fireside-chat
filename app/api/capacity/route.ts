import { NextResponse } from 'next/server';
import { seatsForForm } from '@/lib/capacity-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** For the registration form: are onsite seats left? Counts only, no names. */
export async function GET() {
  try {
    const { full, left, max } = await seatsForForm();
    return NextResponse.json({ onsite: { full, left, max } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[capacity]', e instanceof Error ? e.message : e);
    // Unknown: the form leaves Onsite open and the registration itself decides.
    return NextResponse.json({ onsite: null }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
