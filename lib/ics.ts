// The calendar invite (.ics) for the Fireside Chat: downloaded from the boarding pass and attached
// to the confirmation email. Works in the browser and on the server.
import { EVENT, venueFull } from './config';

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const inviteFileName = (ref: string) => `TM241-Fireside-Chat-${ref}.ics`;

export function buildInvite({ ref, name, organization }: { ref: string; name: string; organization: string }) {
  const description = [
    `${EVENT.series}: ${EVENT.title}`,
    EVENT.subtitle,
    '',
    `Reference No.: ${ref}`,
    `Registered: ${name}${organization ? ` (${organization})` : ''}`,
    `Organizer: ${EVENT.organizer}`,
  ].join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UP Diliman TMC//TM241 Fireside Chat//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ref}@tm241-fireside-chat`,
    `DTSTAMP:${icsTime(new Date().toISOString())}`,
    `DTSTART:${icsTime(EVENT.startsAt)}`,
    `DTEND:${icsTime(EVENT.endsAt)}`,
    `SUMMARY:${icsText(`${EVENT.series}: ${EVENT.title}`)}`,
    `LOCATION:${icsText(venueFull())}`,
    `DESCRIPTION:${icsText(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`${EVENT.series} is tomorrow`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** "Add to Google Calendar" link — event details only, nothing about the registrant. */
export function googleCalendarUrl(siteUrl: string) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${EVENT.series}: ${EVENT.title}`,
    dates: `${icsTime(EVENT.startsAt)}/${icsTime(EVENT.endsAt)}`,
    details: `${EVENT.subtitle}\n\nOrganized by the ${EVENT.organizer}\n${siteUrl}`,
    location: venueFull(),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export const mapsUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${EVENT.venue}, UP Diliman, Quezon City`)}`;
