// The email that brings the Certificate of Participation (attached as a PDF) after the feedback form.
import { EVENT } from '../config';
import { BODY, C, DISPLAY, esc, footerRows, greetingName, headerRow, label, MONO, shell, type EmailImage, type RenderOptions } from './parts';

export interface CertificateEmailData {
  /** As printed on the certificate. */
  name: string;
  email: string;
  number: string;
}

export const CERTIFICATE_IMAGES: EmailImage[] = ['hero-thanks'];

export const certificateSubject = () => `Your Certificate of Participation · ${EVENT.series}`;

export function renderCertificateEmail(c: CertificateEmailData, o: RenderOptions, fileName: string) {
  const hi = greetingName(c.name);
  const event = `${EVENT.series}: ${EVENT.title}`;
  const rows = [
    headerRow(o.src('hero-thanks'), `${esc(event)}. Thank you for joining us.`),
    `  <!-- message -->
  <tr><td class="px" style="padding:32px 36px 8px;background:${C.card};font-family:${BODY};" bgcolor="${C.card}">
    <div style="font-size:16px;line-height:24px;color:${C.cyan2};">Hi ${esc(hi)},</div>
    <h1 class="h1" style="margin:6px 0 0;font-family:${DISPLAY};font-weight:400;font-size:36px;line-height:38px;letter-spacing:.5px;text-transform:uppercase;color:${C.ink};">Thank you for joining us</h1>
    <p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${C.ink2};">
      Thank you for being part of the <b style="color:${C.ink};">${esc(event)}</b> and for sharing your feedback. It helps us make the next conversation better.
    </p>
    <p style="margin:14px 0 0;font-size:16px;line-height:25px;color:${C.ink2};">
      Your <b style="color:${C.ink};">Certificate of Participation</b> is attached to this email as a PDF.
    </p>
  </td></tr>`,
    `  <!-- certificate -->
  <tr><td class="px" style="padding:24px 28px 8px;background:${C.card};" bgcolor="${C.card}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.pass}" style="border-collapse:separate;background:${C.pass};background-image:linear-gradient(135deg,#17236e 0%,#0f1450 58%,#1c1046 100%);border-radius:20px;">
      <tr><td class="pass-px" style="padding:20px 22px 6px;font-family:${BODY};">
        <div style="font-family:${DISPLAY};font-size:14px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${C.mint};">Certificate of Participation</div>
        <div style="padding-top:16px;">${label('Presented to')}</div>
        <div class="pass-name" style="font-family:${DISPLAY};font-size:30px;line-height:34px;letter-spacing:.3px;text-transform:uppercase;color:${C.ink};padding-top:3px;word-break:break-word;">${esc(c.name)}</div>
      </td></tr>
      <tr><td class="pass-px" style="padding:12px 22px 22px;font-family:${BODY};">
        ${label('Certificate No.')}
        <div style="font-family:${MONO};font-size:17px;line-height:26px;letter-spacing:1px;color:${C.ink2};font-weight:bold;">${esc(c.number)}</div>
        <div style="padding-top:10px;font-size:13px;line-height:19px;color:${C.muted};">Attached: <span style="color:${C.ink3};">${esc(fileName)}</span></div>
      </td></tr>
    </table>
  </td></tr>`,
    `  <tr><td class="px" style="padding:18px 36px 30px;background:${C.card};font-family:${BODY};font-size:14px;line-height:22px;color:${C.ink3};" bgcolor="${C.card}">
    Is your name misspelled? Reply to this email with the correct spelling and we&rsquo;ll send you a corrected certificate.
  </td></tr>`,
    footerRows({ ref: c.number, name: c.name, email: c.email, organization: '', affiliation: '' }, o),
  ];

  const subject = certificateSubject();
  const html = shell({ title: subject, preheader: `Thank you for joining the ${event}. Your certificate is attached (${c.number}).`, rows: rows.join('\n\n') });
  const text = [
    `Hi ${hi},`,
    '',
    `Thank you for being part of the ${event} and for sharing your feedback. It helps us make the next conversation better.`,
    '',
    'Your Certificate of Participation is attached to this email as a PDF.',
    '',
    `Presented to:    ${c.name}`,
    `Certificate No.: ${c.number}`,
    `Attached:        ${fileName}`,
    '',
    "Is your name misspelled? Reply to this email with the correct spelling and we'll send you a corrected certificate.",
    '',
    EVENT.organizer,
    o.siteUrl,
  ].join('\n');
  return { subject, html, text };
}
