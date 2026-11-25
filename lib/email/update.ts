// The email for an update an organizer wrote (lib/updates.ts): their headline and message, an optional
// Was/Now box and button, and, if chosen, the registrant's own boarding pass and calendar buttons.
import { EVENT } from '../config';
import { googleCalendarUrl, inviteFileName, mapsUrl } from '../ics';
import type { UpdateContent } from '../updates';
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
  MONO,
  passRow,
  shell,
  type EmailImage,
  type RenderOptions,
  type TicketEmailData,
} from './parts';

/** The images one update email uses (and attaches). */
export function updateImagesFor(u: Pick<UpdateContent, 'includePass'>, d: Pick<TicketEmailData, 'attendanceMode' | 'joinUrl'>): EmailImage[] {
  if (!u.includePass) return ['hero-update'];
  return ['hero-update', 'logo', isOnline(d) ? (d.joinUrl ? 'zoom' : 'icon-video') : 'qr'];
}

/** Fills in {name} and {ref}. */
export const personalize = (s: string, d: Pick<TicketEmailData, 'name' | 'ref'>) =>
  s.replace(/\{name\}/gi, () => greetingName(d.name)).replace(/\{ref\}/gi, () => d.ref);

const LINK = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'’”]/g;

/** One line of the message: escaped, with **bold** and clickable links. */
function inline(line: string) {
  const bold = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, `<b style="color:${C.ink};">$1</b>`);
  let out = '';
  let from = 0;
  for (const m of line.matchAll(LINK)) {
    out += bold(line.slice(from, m.index));
    out += `<a href="${esc(m[0])}" target="_blank" style="color:${C.cyan2};text-decoration:underline;word-break:break-word;">${esc(m[0])}</a>`;
    from = m.index + m[0].length;
  }
  return out + bold(line.slice(from));
}

/** The message as paragraphs and bullet lists. */
export function messageHtml(message: string) {
  const blocks: string[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(`<p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${C.ink2};">${para.join('<br>')}</p>`);
    if (bullets.length) {
      const rows = bullets
        .map(
          (b) => `<tr>
  <td width="22" valign="top" style="width:22px;padding:0 0 8px 0;font-family:${BODY};font-size:16px;line-height:24px;font-weight:bold;color:${C.mint};">&bull;</td>
  <td valign="top" style="padding:0 0 8px 0;font-family:${BODY};font-size:16px;line-height:24px;color:${C.ink2};">${b}</td>
</tr>`,
        )
        .join('\n');
      blocks.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 0;">${rows}</table>`);
    }
    para = [];
    bullets = [];
  };
  for (const raw of message.split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^[-•]\s+(.*)$/);
    if (!line) flush();
    else if (bullet) {
      if (para.length) flush();
      bullets.push(inline(bullet[1]));
    } else {
      if (bullets.length) flush();
      para.push(inline(line));
    }
  }
  flush();
  return blocks.join('\n');
}

/** The message for mail apps that show plain text. */
export const messageText = (message: string) => message.replace(/\*\*(.+?)\*\*/g, '$1');

export function renderUpdateEmail(u: UpdateContent, d: TicketEmailData, o: RenderOptions) {
  const online = isOnline(d);
  const joinUrl = online && d.joinUrl ? d.joinUrl : '';
  const subject = personalize(u.subject, d);
  const headline = personalize(u.headline, d);
  const message = personalize(u.message, d);
  const calendarUrl = googleCalendarUrl(o.siteUrl, online, joinUrl || null);
  const preheader = messageText(message).replace(/\s+/g, ' ').slice(0, 150);
  const directions = u.includePass && !online;

  const sections = [
    headerRow(o.src('hero-update'), `${esc(EVENT.series)}: ${esc(EVENT.title)}. Event update.`),
    `  <!-- message -->
  <tr><td class="px" style="padding:32px 36px 8px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <div style="font-size:16px;line-height:24px;color:${C.cyan2};">Hi ${esc(greetingName(d.name))},</div>
    <h1 class="h1" style="margin:6px 0 0;font-family:${DISPLAY};font-weight:400;font-size:36px;line-height:38px;letter-spacing:.5px;text-transform:uppercase;color:${C.ink};word-break:break-word;">${esc(headline)}</h1>
    ${messageHtml(message)}
  </td></tr>`,
    u.now
      ? `  <!-- was, now -->
  <tr><td class="px" style="padding:22px 28px 0;background:${C.card};" bgcolor="${C.card}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.pass}" style="border-collapse:separate;background:${C.pass};border-radius:20px;border:1px solid ${C.line};">${
      u.before
        ? `
      <tr><td class="pass-px" style="padding:20px 22px 6px;font-family:${BODY};">
        ${label('Was')}
        <div style="padding-top:3px;font-family:${DISPLAY};font-size:19px;line-height:26px;letter-spacing:.5px;text-transform:uppercase;color:${C.muted};text-decoration:line-through;word-break:break-word;">${esc(u.before)}</div>
      </td></tr>`
        : ''
    }
      <tr><td class="pass-px" style="padding:${u.before ? 8 : 20}px 22px 20px;font-family:${BODY};">
        <div style="font-family:${MONO};font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">Now</div>
        <div class="big-now" style="padding-top:3px;font-family:${DISPLAY};font-size:${u.now.length > 24 ? 26 : 38}px;line-height:${u.now.length > 24 ? 32 : 44}px;letter-spacing:.5px;text-transform:uppercase;color:${C.mint};word-break:break-word;">${esc(u.now)}</div>
      </td></tr>
    </table>
  </td></tr>`
      : '',
    u.buttonLabel && u.buttonUrl
      ? `  <!-- button -->
  <tr><td class="px" align="center" style="padding:24px 28px 0;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <a class="btn" href="${esc(u.buttonUrl)}" target="_blank" style="display:inline-block;margin:6px;padding:15px 30px;border-radius:999px;background:${C.mint};background-image:linear-gradient(135deg,${C.mint},${C.cyan});color:#050122;font-family:${BODY};font-size:16px;line-height:20px;font-weight:bold;text-decoration:none;">${esc(u.buttonLabel)}</a>
  </td></tr>`
      : '',
    u.includePass
      ? `  <tr><td class="px" style="padding:30px 36px 0;background:${C.card};" bgcolor="${C.card}">
    <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">Your boarding pass</div>
  </td></tr>
${passRow(d, o)}`
      : '',
    u.attachInvite || directions
      ? `  <!-- calendar and directions -->
  <tr><td class="px" align="center" style="padding:22px 28px 4px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">${
    u.attachInvite
      ? `
    <a class="btn" href="${esc(calendarUrl)}" target="_blank" style="display:inline-block;margin:6px;padding:12px 24px;border-radius:999px;border:2px solid ${C.mint};color:${C.ink2};font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Add to Google Calendar</a>`
      : ''
  }${
    directions
      ? `
    <a class="btn" href="${esc(mapsUrl())}" target="_blank" style="display:inline-block;margin:6px;padding:12px 24px;border-radius:999px;border:2px solid ${C.cyan};color:${C.ink2};font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Get directions</a>`
      : ''
  }${
    u.attachInvite
      ? `
    <div style="padding-top:10px;font-size:13px;line-height:19px;color:${C.muted};">Using Outlook or Apple Calendar? Open the attached invite (<span style="color:${C.ink3};">.ics</span> file).</div>`
      : ''
  }
  </td></tr>`
      : '',
    `  <tr><td style="height:30px;line-height:30px;font-size:0;background:${C.card};" bgcolor="${C.card}">&nbsp;</td></tr>`,
    footerRows(d, o),
  ];

  const html = shell({ title: subject, preheader, rows: sections.filter(Boolean).join('\n\n') });

  const text = [
    `Hi ${greetingName(d.name)},`,
    '',
    headline,
    '',
    messageText(message),
    ...(u.now ? ['', ...(u.before ? [`Was: ${u.before}`] : []), `Now: ${u.now}`] : []),
    ...(u.buttonLabel && u.buttonUrl ? ['', `${u.buttonLabel}: ${u.buttonUrl}`] : []),
    ...(u.includePass
      ? [
          '',
          'Your boarding pass',
          `Passenger:     ${d.name.trim()}`,
          `Reference No.: ${d.ref}`,
          `When:          ${EVENT.weekday}, ${EVENT.dateEn}, ${EVENT.time} (Philippine time)`,
          online ? 'Where:         Online, live on Zoom' : `Where:         ${EVENT.venue}, ${EVENT.venueCampus}`,
          ...(online
            ? [joinUrl ? `Join on Zoom:  ${joinUrl}` : 'Zoom link: we will email it to you before the event.']
            : ['At the door: show the QR code in this email (or on your saved boarding pass).', `Directions: ${mapsUrl()}`]),
        ]
      : []),
    ...(u.attachInvite ? ['', `Calendar: open the attached ${inviteFileName(d.ref)}, or add it to Google Calendar: ${calendarUrl}`] : []),
    '',
    EVENT.organizer,
    o.siteUrl,
  ].join('\n');

  return { subject, html, text };
}
