// The confirmation email a registrant receives: the galaxy header artwork, their boarding pass with
// its scannable QR code, calendar and directions buttons, and the event details.
//
// Written as plain tables with inline styles so it holds together in Gmail, Outlook, Apple Mail and
// phone mail apps. Mail apps don't load web fonts or SVG reliably, so the headline art and icons are
// images and every font has a system fallback.
import { EVENT } from '../config';
import { googleCalendarUrl, inviteFileName, mapsUrl } from '../ics';

export interface TicketEmailData {
  ref: string;
  name: string;
  email: string;
  organization: string;
  /** Already resolved: "Other" replaced by what the person typed. */
  affiliation: string;
  question?: string;
  /** "Online" gets the Zoom button instead of the QR code; anything else is onsite. */
  attendanceMode?: string;
  /** The Zoom link (online only); null when it isn't set on the server yet. */
  joinUrl?: string | null;
}

export const EMAIL_IMAGES = [
  'hero',
  'hero-online',
  'logo',
  'qr',
  'icon-calendar',
  'icon-clock',
  'icon-pin',
  'icon-scan',
  'icon-video',
  'zoom',
  'hero-new-time',
  'hero-new-time-online',
] as const;
export type EmailImage = (typeof EMAIL_IMAGES)[number];

export const isOnline = (d: Pick<TicketEmailData, 'attendanceMode'>) => d.attendanceMode === 'Online';

/**
 * The announcement sent to people who registered before the time changed: the email leads with the
 * old and new time, then shows their up-to-date boarding pass.
 */
export interface TimeNotice {
  /** The time they were told when they registered. */
  wasTime: string;
  /** How much the start moved, in words. */
  moved: string;
}
export const NEW_TIME: TimeNotice = { wasTime: '1:30 PM – 3:30 PM', moved: '30 minutes earlier' };

/** The images one email uses (and attaches): the QR code and directions onsite, the Zoom art online. */
export function emailImagesFor(d: Pick<TicketEmailData, 'attendanceMode' | 'joinUrl'>, notice?: TimeNotice): EmailImage[] {
  if (notice) {
    return isOnline(d) ? ['hero-new-time-online', 'logo', d.joinUrl ? 'zoom' : 'icon-video'] : ['hero-new-time', 'logo', 'qr'];
  }
  if (!isOnline(d)) return ['hero', 'logo', 'qr', 'icon-calendar', 'icon-clock', 'icon-pin', 'icon-scan'];
  // the Zoom logo sits in the Join on Zoom button, so only when there is a link to join
  return ['hero-online', 'logo', 'icon-calendar', 'icon-clock', 'icon-video', ...(d.joinUrl ? (['zoom'] as const) : [])];
}

export interface RenderOptions {
  /** Public address of the site, for links. */
  siteUrl: string;
  /** Where each image comes from: "cid:…" in a sent email, a data: URL in the browser preview. */
  src: (image: EmailImage) => string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const C = {
  page: '#050122',
  card: '#0a0b30',
  pass: '#121a52',
  line: '#2b3a78',
  ink: '#ffffff',
  ink2: '#dff6fb',
  ink3: '#b8c3e6',
  muted: '#8c96c6',
  mint: '#8ff0cf',
  cyan: '#5eb6d3',
  cyan2: '#ade3f2',
  coral: '#f2707c',
};
const DISPLAY = "Anton, Impact, 'Arial Narrow Bold', 'Helvetica Neue', Arial, sans-serif";
const BODY = "ABeeZee, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/** "Juan dela Cruz" → "Juan"; keeps the full name when it starts with a title like "Dr.". */
function greetingName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.endsWith('.') ? first : name.trim();
}

export function subjectFor(ref: string, notice?: TimeNotice) {
  if (notice) {
    const start = EVENT.time.split(' – ')[0];
    return `New time: ${EVENT.series} now starts at ${start} · ${EVENT.weekday}, ${EVENT.dateShort.replace(/ \d{4}$/, '')}`;
  }
  return `Your boarding pass for the ${EVENT.series} · ${ref}`;
}

const label = (text: string) =>
  `<div style="font-family:${MONO};font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};">${text}</div>`;

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

/** One line of "What stays the same", with a mint tick. */
const sameRow = (textHtml: string, last = false) => `<tr>
  <td width="28" valign="top" style="width:28px;padding:0 0 ${last ? 0 : 10}px 0;font-family:${BODY};font-size:16px;line-height:23px;font-weight:bold;color:${C.mint};">&#10003;</td>
  <td valign="top" style="padding:0 0 ${last ? 0 : 10}px 0;font-family:${BODY};font-size:15px;line-height:23px;color:${C.ink2};">${textHtml}</td>
</tr>`;

/**
 * The confirmation email. With a notice, the announcement instead: what changed, what stays the same,
 * then the same boarding pass and buttons (all with the new time), without the longer briefing.
 */
export function renderTicketEmail(d: TicketEmailData, o: RenderOptions, notice?: TimeNotice) {
  const ref = esc(d.ref);
  const name = esc(d.name.trim());
  const hi = esc(greetingName(d.name));
  const org = esc(d.organization.trim());
  const affiliation = esc(d.affiliation.trim());
  const question = d.question?.trim() ? esc(d.question.trim()).replace(/\r?\n/g, '<br>') : '';
  const site = esc(o.siteUrl);
  const siteLabel = esc(o.siteUrl.replace(/^https?:\/\//, ''));
  const startTime = EVENT.time.split(' – ')[0];
  const online = isOnline(d);
  const joinUrl = online && d.joinUrl ? d.joinUrl : '';
  const zoomHref = esc(joinUrl);
  const wasStart = notice?.wasTime.split(' – ')[0] ?? '';
  const preheader = notice
    ? `${EVENT.weekday}, ${EVENT.dateEn}: now ${EVENT.time} (it was ${notice.wasTime}). Your registration still stands, so there is no need to register again.`
    : online
    ? `You're registered for ${EVENT.title} — ${EVENT.weekday}, ${EVENT.dateShort}, ${startTime}, online via Zoom. ${joinUrl ? 'Your Join on Zoom button is inside.' : 'We’ll email you the Zoom link before the event.'}`
    : `You're registered for ${EVENT.title} — ${EVENT.weekday}, ${EVENT.dateShort}, ${startTime} at the ${EVENT.venue}, UP Diliman. Show the QR code inside at the door.`;
  const calendarUrl = googleCalendarUrl(o.siteUrl, online, joinUrl || null);

  /** Where the QR code goes on an onsite pass: the Zoom button, or a note while there is no link. */
  // A function, so an onsite email never asks for the Zoom pictures (it doesn't load them).
  const zoomStub = () => joinUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 0;"><tr>
          <td align="center" bgcolor="${C.mint}" style="border-radius:999px;background:${C.mint};background-image:linear-gradient(135deg,${C.mint},${C.cyan});">
            <a href="${zoomHref}" target="_blank" style="display:inline-block;padding:12px 30px 12px 14px;border-radius:999px;font-family:${BODY};font-size:17px;line-height:28px;font-weight:bold;color:#050122;text-decoration:none;white-space:nowrap;"><img src="${o.src('zoom')}" width="28" height="28" alt="Zoom" style="display:inline-block;width:28px;height:28px;border:0;vertical-align:middle;margin:0 10px 0 0;"><span style="vertical-align:middle;">Join on Zoom &rarr;</span></a>
          </td>
        </tr></table>
        <div style="padding-top:12px;font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:${C.ink3};">Opens ${esc(EVENT.weekday)} ${esc(EVENT.dateShort)} &middot; ${esc(startTime)}</div>
        <div style="padding-top:10px;font-size:12px;line-height:18px;color:${C.muted};word-break:break-all;">Button not working? Open this link:<br><a href="${zoomHref}" target="_blank" style="color:${C.cyan2};text-decoration:underline;">${zoomHref}</a></div>`
    : `<img src="${o.src('icon-video')}" width="56" height="56" alt="" style="display:block;margin:0 auto;width:56px;height:56px;border:0;">
        <div style="padding-top:12px;font-size:15px;line-height:22px;color:${C.ink2};">You&rsquo;re joining online.</div>
        <div style="padding-top:4px;font-size:13px;line-height:19px;color:${C.muted};">We&rsquo;ll email you the Zoom link before the event.</div>`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(subjectFor(d.ref, notice))}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=ABeeZee&family=Anton&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:${C.page}; }
  a { color:${C.cyan2}; }
  .btn:hover { opacity:.9; }
  @media (max-width: 520px) {
    .px { padding-left:20px !important; padding-right:20px !important; }
    .pass-px { padding-left:18px !important; padding-right:18px !important; }
    .h1 { font-size:30px !important; line-height:32px !important; }
    .pass-name { font-size:26px !important; line-height:28px !important; }
    .new-time { font-size:31px !important; line-height:38px !important; }
    .meta-td { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .btn { display:block !important; margin:8px 0 !important; text-align:center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};" bgcolor="${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${esc(preheader)}${'&#8199;&#847; '.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:24px 10px 32px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;margin:0 auto;">

  <!-- header artwork -->
  <tr><td style="padding:0;background:${C.card};border-radius:24px 24px 0 0;" bgcolor="${C.card}">
    <img src="${o.src(notice ? (online ? 'hero-new-time-online' : 'hero-new-time') : online ? 'hero-online' : 'hero')}" width="600" alt="${esc(EVENT.series)}: ${esc(EVENT.title)}. ${notice ? 'New time' : 'Registered'}. ${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)}, ${esc(EVENT.time)}, ${online ? 'online via Zoom. See you online!' : `${esc(EVENT.venue)}, UP Diliman. See you there!`}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:24px 24px 0 0;color:${C.ink2};font-family:${BODY};font-size:16px;">
  </td></tr>

  <!-- greeting -->
  <tr><td class="px" style="padding:32px 36px 8px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <div style="font-size:16px;line-height:24px;color:${C.cyan2};">Hi ${hi},</div>
    <h1 class="h1" style="margin:6px 0 0;font-family:${DISPLAY};font-weight:400;font-size:36px;line-height:38px;letter-spacing:.5px;text-transform:uppercase;color:${C.ink};">${notice ? `Liftoff is now at ${esc(startTime)}` : 'You&rsquo;re cleared for liftoff!'}</h1>
    <p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${C.ink2};">
      ${
        notice
          ? `The <b style="color:${C.ink};">${esc(EVENT.series)}</b> will start <b style="color:${C.ink};">${esc(notice.moved)}</b> than we first announced. Your registration still stands, so there&rsquo;s no need to register again. We&rsquo;re sorry for the short notice, and thank you for adjusting with us.`
          : online
          ? `Your seat at the <b style="color:${C.ink};">${esc(EVENT.series)}</b> is confirmed &mdash; you&rsquo;re joining online. ${
              joinUrl
                ? 'Your boarding pass below has the <b style="color:' + C.ink + ';">Join on Zoom</b> button; use it on the day, a few minutes before the start.'
                : 'We&rsquo;ll email you the Zoom link before the event.'
            }`
          : `Your seat at the <b style="color:${C.ink};">${esc(EVENT.series)}</b> is confirmed. Below is your boarding pass &mdash; show its QR code at the registration desk on the day, on your phone or printed.`
      }
    </p>
  </td></tr>
${
  notice
    ? `
  <!-- old time, new time -->
  <tr><td class="px" style="padding:22px 28px 0;background:${C.card};" bgcolor="${C.card}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.pass}" style="border-collapse:separate;background:${C.pass};border-radius:20px;border:1px solid ${C.line};">
      <tr><td class="pass-px" style="padding:20px 22px 6px;font-family:${BODY};">
        ${label('Was')}
        <div style="padding-top:3px;font-family:${DISPLAY};font-size:19px;line-height:26px;letter-spacing:.5px;text-transform:uppercase;color:${C.muted};text-decoration:line-through;">${esc(notice.wasTime)}</div>
      </td></tr>
      <tr><td class="pass-px" style="padding:8px 22px 20px;font-family:${BODY};">
        <div style="font-family:${MONO};font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">Now</div>
        <div class="new-time" style="padding-top:3px;font-family:${DISPLAY};font-size:38px;line-height:44px;letter-spacing:.5px;text-transform:uppercase;color:${C.mint};">${esc(EVENT.time)}</div>
        <div style="padding-top:4px;font-size:15px;line-height:22px;color:${C.ink2};">${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)} &middot; Philippine time</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- what stays the same -->
  <tr><td class="px" style="padding:26px 36px 4px;background:${C.card};" bgcolor="${C.card}">
    <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">What stays the same</div>
    <div style="height:1px;line-height:1px;font-size:0;background:${C.line};margin:12px 0 16px;">&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${
        online
          ? `${sameRow(`The date: ${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)}, live on Zoom`)}
      ${
        joinUrl
          ? sameRow('Your Zoom link and reference number. The link you already have still works', true)
          : sameRow('Your reference number. We&rsquo;ll email you the Zoom link before the event', true)
      }`
          : `${sameRow(`The date: ${esc(EVENT.weekday)}, ${esc(EVENT.dateEn)}`)}
      ${sameRow(`The venue: ${esc(EVENT.venue)}, UP Diliman`)}
      ${sameRow('Your reference number and QR code. The pass you already have still works at the door', true)}`
      }
    </table>
  </td></tr>

  <tr><td class="px" style="padding:26px 36px 0;background:${C.card};" bgcolor="${C.card}">
    <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.mint};">Your updated boarding pass</div>
  </td></tr>`
    : ''
}
  <!-- boarding pass -->
  <tr><td class="px" style="padding:24px 28px 8px;background:${C.card};" bgcolor="${C.card}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.pass}" style="border-collapse:separate;background:${C.pass};background-image:linear-gradient(135deg,#17236e 0%,#0f1450 58%,#1c1046 100%);border-radius:20px;">
      <tr><td class="pass-px" style="padding:13px 22px;border-radius:20px 20px 0 0;background:#1a2a66;background-image:linear-gradient(90deg,#1c3f7c,#36205a);border-bottom:1px dashed #3d5590;" bgcolor="#1a2a66">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${C.ink2};">&#10022;&nbsp; Boarding pass</td>
          <td align="right" style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:3px;text-transform:uppercase;color:${online ? C.mint : C.coral};">${online ? 'Joining online' : 'Admit one'}</td>
        </tr></table>
      </td></tr>
      <tr><td class="pass-px" style="padding:20px 22px 6px;font-family:${BODY};">
        <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${C.mint};">${esc(EVENT.series)}</div>
        <div style="padding-top:8px;"><img src="${o.src('logo')}" width="260" height="128" alt="${esc(EVENT.title)}" style="display:block;width:260px;max-width:100%;height:auto;border:0;font-family:${DISPLAY};font-size:24px;line-height:26px;text-transform:uppercase;color:${C.ink};"></div>
        <div style="padding-top:18px;">${label('Passenger')}</div>
        <div class="pass-name" style="font-family:${DISPLAY};font-size:30px;line-height:32px;letter-spacing:.3px;text-transform:uppercase;color:${C.ink};padding-top:3px;word-break:break-word;">${name}</div>
        <div style="padding-top:6px;font-size:14px;line-height:22px;color:${C.ink3};word-break:break-word;">
          ${org}${affiliation ? `${org ? '&nbsp; ' : ''}<span style="display:inline-block;padding:0 10px;border-radius:999px;background:#1d3566;border:1px solid #2f5d86;font-size:12px;line-height:20px;color:${C.ink2};white-space:nowrap;">${affiliation}</span>` : ''}
        </div>
      </td></tr>
      <tr><td class="pass-px" style="padding:14px 22px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line};"><tr>
          <td class="meta-td" valign="top" width="50%" style="padding-top:14px;">${label('Date')}<div style="font-family:${DISPLAY};font-size:17px;line-height:22px;letter-spacing:.6px;text-transform:uppercase;color:${C.ink};white-space:nowrap;">${esc(EVENT.dateShort)}</div></td>
          <td class="meta-td" valign="top" width="50%" style="padding-top:14px;">${label('Boarding')}<div style="font-family:${DISPLAY};font-size:17px;line-height:22px;letter-spacing:.6px;text-transform:uppercase;color:${C.ink};white-space:nowrap;">${esc(startTime)}</div></td>
        </tr><tr>
          <td class="meta-td" valign="top" colspan="2" style="padding-top:12px;">${label('Gate')}<div style="font-family:${DISPLAY};font-size:17px;line-height:22px;letter-spacing:.6px;text-transform:uppercase;color:${C.ink};">${online ? 'Online &middot; <span style="white-space:nowrap;">Live on Zoom</span>' : `${esc(EVENT.venue)} &middot; <span style="white-space:nowrap;">UP Diliman</span>`}</div></td>
        </tr></table>
      </td></tr>
      <!-- tear line -->
      <tr><td style="padding:0;font-size:0;line-height:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="14" style="width:14px;font-size:0;line-height:0;"><div style="width:14px;height:28px;background:${C.card};border-radius:0 14px 14px 0;"></div></td>
          <td style="padding:0 8px;font-size:0;line-height:0;"><div style="height:0;border-top:2px dashed #46609c;font-size:0;line-height:0;">&nbsp;</div></td>
          <td width="14" style="width:14px;font-size:0;line-height:0;"><div style="width:14px;height:28px;background:${C.card};border-radius:14px 0 0 14px;"></div></td>
        </tr></table>
      </td></tr>
      <!-- stub -->
      <tr><td align="center" style="padding:16px 22px 26px;font-family:${BODY};">
        ${
          online
            ? zoomStub()
            : `<img src="${o.src('qr')}" width="200" height="200" alt="QR code for reference number ${ref}" style="display:block;margin:0 auto;width:200px;height:200px;border:0;border-radius:14px;box-shadow:0 0 0 1px rgba(173,227,242,.45),0 14px 32px -14px rgba(94,182,211,.8);">`
        }
        <div style="padding-top:16px;">${label('Reference No.')}</div>
        <div style="font-family:${MONO};font-size:21px;line-height:28px;letter-spacing:1.5px;color:${C.ink2};font-weight:bold;">${ref}</div>
        ${online ? '' : `<div style="padding-top:6px;font-size:13px;line-height:19px;color:${C.muted};">Show this code at the registration desk</div>`}
      </td></tr>
    </table>
  </td></tr>

  <!-- buttons -->
  <tr><td class="px" align="center" style="padding:22px 28px 4px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <a class="btn" href="${esc(calendarUrl)}" target="_blank" style="display:inline-block;margin:6px;padding:14px 24px;border-radius:999px;background:${C.mint};background-image:linear-gradient(135deg,${C.mint},${C.cyan});color:#050122;font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Add to Google Calendar</a>${
      online
        ? ''
        : `
    <a class="btn" href="${esc(mapsUrl())}" target="_blank" style="display:inline-block;margin:6px;padding:12px 24px;border-radius:999px;border:2px solid ${C.cyan};color:${C.ink2};font-family:${BODY};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">Get directions</a>`
    }
    <div style="padding-top:10px;font-size:13px;line-height:19px;color:${C.muted};">${
      notice
        ? `Already in your calendar at ${esc(wasStart)}? Delete that entry and add the new one with the button above, or with the attached invite (<span style="color:${C.ink3};">.ics</span> file) for Outlook and Apple Calendar.`
        : `Using Outlook or Apple Calendar? Open the attached invite (<span style="color:${C.ink3};">.ics</span> file).`
    }</div>
  </td></tr>
${
  notice
    ? `
  <tr><td style="height:28px;line-height:28px;font-size:0;background:${C.card};" bgcolor="${C.card}">&nbsp;</td></tr>`
    : `
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
  </td></tr>`
}

  <!-- closing bar -->
  <tr><td height="5" style="height:5px;font-size:0;line-height:0;border-radius:0 0 24px 24px;background:${C.cyan};background-image:linear-gradient(90deg,${C.mint},${C.cyan} 50%,${C.coral});" bgcolor="${C.cyan}">&nbsp;</td></tr>

  <!-- footer -->
  <tr><td align="center" style="padding:24px 24px 0;font-family:${BODY};font-size:12px;line-height:19px;color:${C.muted};">
    <div style="font-family:${DISPLAY};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${C.ink3};">${esc(EVENT.organizer)}</div>
    <div style="padding-top:8px;">You&rsquo;re receiving this because ${esc(d.email)} was used to register for the ${esc(EVENT.series)} at <a href="${site}" target="_blank" style="color:${C.cyan2};text-decoration:underline;">${siteLabel}</a>. Not you, or have a question? Just reply to this email.</div>
  </td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${greetingName(d.name)},`,
    '',
    ...(notice
      ? [
          `Liftoff is now at ${startTime}. The ${EVENT.series} will start ${notice.moved} than we first announced.`,
          '',
          `Was: ${notice.wasTime}`,
          `Now: ${EVENT.time}, ${EVENT.weekday}, ${EVENT.dateEn} (Philippine time)`,
          '',
          "Your registration still stands, so there's no need to register again. We're sorry for the short notice, and thank you for adjusting with us.",
          online
            ? joinUrl
              ? 'What stays the same: the date, your Zoom link and your reference number.'
              : 'What stays the same: the date and your reference number.'
            : 'What stays the same: the date, the venue, your reference number and your QR code.',
          `Already in your calendar at ${wasStart}? Delete that entry and add the new one (see "Calendar" below).`,
        ]
      : [`You're cleared for liftoff! Your seat at the ${EVENT.series} is confirmed.`]),
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
    ...(d.question?.trim() && !notice ? ['', `Your question for the speaker: "${d.question.trim()}" (shared with the moderator)`] : []),
    '',
    online ? 'See you online!' : 'See you there!',
    EVENT.organizer,
    o.siteUrl,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject: subjectFor(d.ref, notice), html, text };
}
