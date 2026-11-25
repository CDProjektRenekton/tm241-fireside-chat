// The confirmation email a registrant receives: the galaxy header artwork, their boarding pass with
// its scannable QR code (or the Join on Zoom button), calendar and directions buttons, and the event
// details. The shared blocks are in parts.ts.
import { EVENT } from '../config';
import { googleCalendarUrl, inviteFileName, mapsUrl } from '../ics';
import {
  BODY,
  C,
  DISPLAY,
  esc,
  footerRows,
  greetingName,
  headerRow,
  isOnline,
  label,
  passRow,
  shell,
  type EmailImage,
  type RenderOptions,
  type TicketEmailData,
} from './parts';

/** The images one email uses (and attaches): the QR code and directions onsite, the Zoom art online. */
export function emailImagesFor(d: Pick<TicketEmailData, 'attendanceMode' | 'joinUrl'>): EmailImage[] {
  if (!isOnline(d)) return ['hero', 'logo', 'qr', 'icon-calendar', 'icon-clock', 'icon-pin', 'icon-scan'];
  // the Zoom logo sits in the Join on Zoom button, so only when there is a link to join
  return ['hero-online', 'logo', 'icon-calendar', 'icon-clock', 'icon-video', ...(d.joinUrl ? (['zoom'] as const) : [])];
}

export function subjectFor(ref: string) {
  return `Your boarding pass for the ${EVENT.series} · ${ref}`;
}

function detailRow(icon: string, title: string, sub: string, o: RenderOptions, last = false) {
  return `<tr>
  <td width="56" valign="top" style="width:56px;padding:0 0 ${last ? 0 : 18}px 0;">
    <img src="${o.src(icon as EmailImage)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0;">
  </td>
  <td valign="top" style="padding:0 0 ${last ? 0 : 18}px 0;font-family:${BODY};">
    <div style="font-size:16px;line-height:22px;color:${C.ink};font-weight:bold;">${title}</div>
    <div style="font-size:14px;line-height:20px;color:${C.ink3};padding-top:2px;">${sub}</div>
  </td>
</tr>`;
}

export function renderTicketEmail(d: TicketEmailData, o: RenderOptions) {
  const hi = esc(greetingName(d.name));
  const question = d.question?.trim() ? esc(d.question.trim()).replace(/\r?\n/g, '<br>') : '';
  const startTime = EVENT.time.split(' – ')[0];
  const online = isOnline(d);
  const joinUrl = online && d.joinUrl ? d.joinUrl : '';
  const preheader = online
    ? `You're registered for ${EVENT.title} — ${EVENT.weekday}, ${EVENT.dateShort}, ${startTime}, online via Zoom. ${joinUrl ? 'Your Join on Zoom button is inside.' : 'We’ll email you the Zoom link before the event.'}`
    : `You're registered for ${EVENT.title} — ${EVENT.weekday}, ${EVENT.dateShort}, ${startTime} at the ${EVENT.venue}, UP Diliman. Show the QR code inside at the door.`;
  const calendarUrl = googleCalendarUrl(o.siteUrl, online, joinUrl || null);

  const rows = `${headerRow(
    o.src(online ? 'hero-online' : 'hero'),
    `${esc(EVENT.series)}: ${esc(EVENT.title)}. Registered. ${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)}, ${esc(EVENT.time)}, ${online ? 'online via Zoom. See you online!' : `${esc(EVENT.venue)}, UP Diliman. See you there!`}`,
  )}

  <!-- greeting -->
  <tr><td class="px" style="padding:32px 36px 8px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <div style="font-size:16px;line-height:24px;color:${C.cyan2};">Hi ${hi},</div>
    <h1 class="h1" style="margin:6px 0 0;font-family:${DISPLAY};font-weight:400;font-size:36px;line-height:38px;letter-spacing:.5px;text-transform:uppercase;color:${C.ink};">You&rsquo;re cleared for liftoff!</h1>
    <p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${C.ink2};">
      ${
        online
          ? `Your seat at the <b style="color:${C.ink};">${esc(EVENT.series)}</b> is confirmed &mdash; you&rsquo;re joining online. ${
              joinUrl
                ? 'Your boarding pass below has the <b style="color:' + C.ink + ';">Join on Zoom</b> button; use it on the day, a few minutes before the start.'
                : 'We&rsquo;ll email you the Zoom link before the event.'
            }`
          : `Your seat at the <b style="color:${C.ink};">${esc(EVENT.series)}</b> is confirmed. Below is your boarding pass &mdash; show its QR code at the registration desk on the day, on your phone or printed.`
      }
    </p>
  </td></tr>

${passRow(d, o)}

  <!-- buttons -->
  <tr><td class="px" align="center" style="padding:22px 28px 4px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <a class="btn" href="${esc(calendarUrl)}" target="_blank" style="display:inline-block;margin:6px;padding:14px 24px;border-radius:999px;background:${C.mint};background-image:linear-gradient(135deg,${C.mint},${C.cyan});color:#050122;font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Add to Google Calendar</a>${
      online
        ? ''
        : `
    <a class="btn" href="${esc(mapsUrl())}" target="_blank" style="display:inline-block;margin:6px;padding:12px 24px;border-radius:999px;border:2px solid ${C.cyan};color:${C.ink2};font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Get directions</a>`
    }
    <div style="padding-top:10px;font-size:13px;line-height:19px;color:${C.muted};">Using Outlook or Apple Calendar? Open the attached invite (<span style="color:${C.ink3};">.ics</span> file).</div>
  </td></tr>

  <!-- event details -->
  <tr><td class="px" style="padding:30px 36px 6px;background:${C.card};" bgcolor="${C.card}">
    <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">Mission briefing</div>
    <div style="height:1px;line-height:1px;font-size:0;background:${C.line};margin:12px 0 20px;">&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${detailRow('icon-calendar', `${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)}`, 'Mark your calendar &mdash; the invite is attached.', o)}
      ${
        online
          ? `${detailRow('icon-clock', esc(EVENT.time), 'Philippine time. Join a few minutes early.', o)}
      ${detailRow(
        'icon-video',
        'Online via Zoom',
        joinUrl
          ? 'Use the Join on Zoom button above, and join with your registered name so we can welcome you.'
          : 'We&rsquo;ll email you the Zoom link before the event.',
        o,
        true,
      )}`
          : `${detailRow('icon-clock', esc(EVENT.time), 'Philippine time. Come a little early to check in.', o)}
      ${detailRow('icon-pin', esc(EVENT.venue), esc(EVENT.venueCampus), o)}
      ${detailRow('icon-scan', 'At the door', 'Open this email or your saved pass. The desk scans your QR code and you&rsquo;re in.', o, true)}`
      }
    </table>
  </td></tr>
${
  question
    ? `
  <!-- their question -->
  <tr><td class="px" style="padding:26px 36px 4px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding:16px 18px;background:${C.pass};border-left:3px solid ${C.coral};border-radius:0 14px 14px 0;" bgcolor="${C.pass}">
        ${label('Your question for the speaker')}
        <div style="padding-top:6px;font-size:15px;line-height:23px;color:${C.ink2};font-style:italic;">&ldquo;${question}&rdquo;</div>
        <div style="padding-top:8px;font-size:13px;line-height:19px;color:${C.muted};">We&rsquo;ve shared it with the moderator.</div>
      </td>
    </tr></table>
  </td></tr>`
    : ''
}

  <!-- about -->
  <tr><td class="px" style="padding:26px 36px 32px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">About the chat</div>
    <div style="padding-top:10px;font-size:15px;line-height:23px;color:${C.ink};font-weight:bold;">${esc(EVENT.subtitle)}</div>
    <div style="padding-top:6px;font-size:15px;line-height:23px;color:${C.ink3};">${esc(EVENT.blurb)}</div>
  </td></tr>

${footerRows(d, o)}
`;
  const html = shell({ title: subjectFor(d.ref), preheader, rows });

  const text = [
    `Hi ${greetingName(d.name)},`,
    '',
    `You're cleared for liftoff! Your seat at the ${EVENT.series} is confirmed.`,
    '',
    `${EVENT.series}: ${EVENT.title}`,
    EVENT.subtitle,
    '',
    `Passenger:     ${d.name.trim()}`,
    d.organization.trim() ? `Organization:  ${d.organization.trim()}` : null,
    d.affiliation.trim() ? `Affiliation:   ${d.affiliation.trim()}` : null,
    `Reference No.: ${d.ref}`,
    '',
    `When:  ${EVENT.weekday}, ${EVENT.dateEn}, ${EVENT.time} (Philippine time)`,
    ...(online
      ? [
          'Where: Online, live on Zoom',
          '',
          joinUrl
            ? `Join on Zoom: ${joinUrl}\n(Join a few minutes early, with your registered name.)`
            : 'Zoom link: we will email it to you before the event.',
          `Calendar: open the attached ${inviteFileName(d.ref)}, or add it to Google Calendar: ${calendarUrl}`,
        ]
      : [
          `Where: ${EVENT.venue}, ${EVENT.venueCampus}`,
          '',
          'At the door: show the QR code in this email (or on your saved boarding pass) at the registration desk.',
          `Calendar: open the attached ${inviteFileName(d.ref)}, or add it to Google Calendar: ${calendarUrl}`,
          `Directions: ${mapsUrl()}`,
        ]),
    ...(d.question?.trim() ? ['', `Your question for the speaker: "${d.question.trim()}" (shared with the moderator)`] : []),
    '',
    online ? 'See you online!' : 'See you there!',
    EVENT.organizer,
    o.siteUrl,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject: subjectFor(d.ref), html, text };
}
