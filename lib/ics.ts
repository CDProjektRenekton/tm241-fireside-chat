// The calendar invite (.ics) for the Fireside Chat: downloaded from the boarding pass and attached
// to the confirmation email. Works in the browser and on the server.
import { EVENT, venueFull } from './config';

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const inviteFileName = (ref: string) => `TM241-Fireside-Chat-${ref}.ics`;

/** Where the calendar entry says the event is: the venue, or for online registrants the Zoom link. */
function locationFor(online: boolean, joinUrl?: string | null) {
  if (!online) return venueFull();
  return joinUrl ?? 'Online via Zoom (link sent by email)';
}

export interface InviteDetails {
  ref: string;
  name: string;
  organization: string;
  /** Online registrants: the Zoom link goes in the location and description. */
  online?: boolean;
  joinUrl?: string | null;
}

export function buildInvite({ ref, name, organization, online = false, joinUrl }: InviteDetails) {
  const description = [
    `${EVENT.series}: ${EVENT.title}`,
    EVENT.subtitle,
    '',
    ...(online ? [joinUrl ? `Join on Zoom: ${joinUrl}` : 'Joining online: the Zoom link will be sent by email.', ''] : []),
    `Reference No.: ${ref}`,
    `Registered: ${name}${organization ? ` (${organization})` : ''}${online ? ' · joining online' : ''}`,
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
    `LOCATION:${icsText(locationFor(online, joinUrl))}`,
    ...(online && joinUrl ? [`URL:${joinUrl}`] : []),
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

/** "Add to Google Calendar" link — event details only (plus the Zoom link for online registrants). */
export function googleCalendarUrl(siteUrl: string, online = false, joinUrl?: string | null) {
  const zoom = online ? (joinUrl ? `Join on Zoom: ${joinUrl}\n\n` : 'Joining online: the Zoom link will be sent by email.\n\n') : '';
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${EVENT.series}: ${EVENT.title}`,
    dates: `${icsTime(EVENT.startsAt)}/${icsTime(EVENT.endsAt)}`,
    details: `${zoom}${EVENT.subtitle}\n\nOrganized by the ${EVENT.organizer}\n${siteUrl}`,
    location: locationFor(online, joinUrl),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

export const mapsUrl = () =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${EVENT.venueBuilding}, UP Diliman, Quezon City`)}`;
