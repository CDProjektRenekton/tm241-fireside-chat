import 'server-only';

/**
 * The Zoom link for online registrants. It lives only in the environment (ZOOM_JOIN_URL in
 * Vercel → Settings → Environment Variables), never in the code: the repository is public, and
 * the link — passcode included — should reach only people who registered to join online.
 *
 * Without it, online registration still works; the boarding pass and email then say the link
 * will be sent by email before the event.
 */
const NAMES = ['ZOOM_JOIN_URL', 'ZOOM_URL', 'ZOOM_LINK'];

export function zoomJoinUrl(): string | null {
  for (const n of NAMES) {
    const v = process.env[n]?.trim().replace(/^["']|["']$/g, '').trim();
    if (!v) continue;
    try {
      const u = new URL(v);
      if (u.protocol === 'https:') return u.toString();
    } catch {
      /* not a URL — ignore */
    }
  }
  return null;
}

/** For /api/health — says whether the link is set, never what it is. */
export function zoomStatus() {
  const set = zoomJoinUrl() !== null;
  return set
    ? { configured: true }
    : { configured: false, problem: 'Add ZOOM_JOIN_URL so online registrants get the Zoom link.' };
}
