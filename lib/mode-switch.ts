// Moving a registrant between onsite and online (dashboard → View details): the email they get.
// It is an ordinary email update (lib/updates.ts) with fixed words, so it looks like the others: a Was/Now
// box, their new boarding pass (QR code onsite, Join on Zoom online) and a fresh calendar invite.
import { EVENT, type AttendanceMode } from './config';
import { EMPTY_UPDATE, type UpdateContent } from './updates';

const when = `${EVENT.weekday}, ${EVENT.dateEn}`;

export const MODE_WORDS: Record<AttendanceMode, string> = { Onsite: 'Onsite, UP Diliman', Online: 'Online, on Zoom' };

/** The email for someone who is now joining `to`. */
export function modeSwitchUpdate(to: AttendanceMode): UpdateContent {
  const base = { ...EMPTY_UPDATE, before: MODE_WORDS[to === 'Onsite' ? 'Online' : 'Onsite'], now: MODE_WORDS[to], includePass: true, attachInvite: true };
  if (to === 'Onsite') {
    return {
      ...base,
      subject: `You're now joining the ${EVENT.series} onsite`,
      headline: 'See you onsite',
      message: `Your registration has been updated: you're now joining the **${EVENT.series}: ${EVENT.title}** in person, on **${when}**, ${EVENT.time} (Philippine time), at the **${EVENT.venue}**, ${EVENT.venueCampus}.\n\nAt the door, show the QR code on your new boarding pass below.`,
    };
  }
  return {
    ...base,
    subject: `You're now joining the ${EVENT.series} online`,
    headline: 'See you on Zoom',
    message: `Your registration has been updated: you're now joining the **${EVENT.series}: ${EVENT.title}** online, live on Zoom, on **${when}**, ${EVENT.time} (Philippine time).\n\n- Use the Join on Zoom button on your new boarding pass below.\n- Please join a few minutes early, with your registered name.`,
  };
}
