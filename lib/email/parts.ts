// Building blocks shared by every email: the page around it, the header artwork, the boarding pass,
// the footer. Written as plain tables with inline styles so it holds together in Gmail, Outlook,
// Apple Mail and phone mail apps. Mail apps don't load web fonts or SVG reliably, so the headline art
// and icons are images and every font has a system fallback.
import { EVENT } from '../config';

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
  'hero-update',
  'hero-thanks',
  'logo',
  'qr',
  'icon-calendar',
  'icon-clock',
  'icon-pin',
  'icon-scan',
  'icon-video',
  'zoom',
] as const;
export type EmailImage = (typeof EMAIL_IMAGES)[number];

export const isOnline = (d: Pick<TicketEmailData, 'attendanceMode'>) => d.attendanceMode === 'Online';

export interface RenderOptions {
  /** Public address of the site, for links. */
  siteUrl: string;
  /** Where each image comes from: "cid:…" in a sent email, a data: URL in the browser preview. */
  src: (image: EmailImage) => string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const C = {
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
export const DISPLAY = "Anton, Impact, 'Arial Narrow Bold', 'Helvetica Neue', Arial, sans-serif";
export const BODY = "ABeeZee, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

/** "Juan dela Cruz" → "Juan"; keeps the full name when it starts with a title like "Dr.". */
export function greetingName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.endsWith('.') ? first : name.trim();
}

export const label = (text: string) =>
  `<div style="font-family:${MONO};font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:${C.muted};">${text}</div>`;

/** The whole email around its rows. */
export function shell({ title, preheader, rows }: { title: string; preheader: string; rows: string }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(title)}</title>
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
    .big-now { font-size:28px !important; line-height:34px !important; }
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

${rows}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** Full-width header picture. */
export const headerRow = (src: string, alt: string) => `  <!-- header artwork -->
  <tr><td style="padding:0;background:${C.card};border-radius:24px 24px 0 0;" bgcolor="${C.card}">
    <img src="${src}" width="600" alt="${alt}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:24px 24px 0 0;color:${C.ink2};font-family:${BODY};font-size:16px;">
  </td></tr>`;

/** The registrant's boarding pass: QR code onsite, Join on Zoom button online. */
export function passRow(d: TicketEmailData, o: RenderOptions) {
  const ref = esc(d.ref);
  const name = esc(d.name.trim());
  const org = esc(d.organization.trim());
  const affiliation = esc(d.affiliation.trim());
  const startTime = EVENT.time.split(' – ')[0];
  const online = isOnline(d);
  const joinUrl = online && d.joinUrl ? d.joinUrl : '';
  const zoomHref = esc(joinUrl);

  /** Where the QR code goes on an onsite pass: the Zoom button, or a note while there is no link. */
  // A function, so an onsite email never asks for the Zoom pictures (it does not load them).
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

  return `  <!-- boarding pass -->
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
  </td></tr>`;
}

/** The colour bar that closes the card, and the line saying why they got the email. */
export function footerRows(d: TicketEmailData, o: RenderOptions) {
  const site = esc(o.siteUrl);
  const siteLabel = esc(o.siteUrl.replace(/^https?:\/\//, ''));
  return `  <!-- closing bar -->
  <tr><td height="5" style="height:5px;font-size:0;line-height:0;border-radius:0 0 24px 24px;background:${C.cyan};background-image:linear-gradient(90deg,${C.mint},${C.cyan} 50%,${C.coral});" bgcolor="${C.cyan}">&nbsp;</td></tr>

  <!-- footer -->
  <tr><td align="center" style="padding:24px 24px 0;font-family:${BODY};font-size:12px;line-height:19px;color:${C.muted};">
    <div style="font-family:${DISPLAY};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${C.ink3};">${esc(EVENT.organizer)}</div>
    <div style="padding-top:8px;">You&rsquo;re receiving this because ${esc(d.email)} was used to register for the ${esc(EVENT.series)} at <a href="${site}" target="_blank" style="color:${C.cyan2};text-decoration:underline;">${siteLabel}</a>. Not you, or have a question? Just reply to this email.</div>
  </td></tr>`;
}
