import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after } from 'next/server';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { EVENT } from '../config';
import { buildInvite, inviteFileName } from '../ics';
import { certificateFileName } from '../certificate';
import type { Registration } from '../types';
import { zoomJoinUrl } from '../zoom';
import { qrPng } from './qr-png';
import type { UpdateContent } from '../updates';
import { isOnline, type EmailImage, type TicketEmailData } from './parts';
import { emailImagesFor, renderTicketEmail } from './template';
import { CERTIFICATE_IMAGES, renderCertificateEmail, type CertificateEmailData } from './certificate';
import { renderUpdateEmail, updateImagesFor } from './update';

/**
 * The confirmation email goes out through any SMTP mail account. Gmail is the default:
 *   SMTP_USER = the Gmail address that sends the emails
 *   SMTP_PASS = a Google "App password" for that account (not its normal password)
 * Other providers (Outlook, Brevo, Resend, a university mail server…) work by also setting
 * SMTP_HOST / SMTP_PORT, and EMAIL_FROM when the login is not an email address.
 * Without SMTP_USER and SMTP_PASS, registration works exactly as before, just without the email.
 */

const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, '').trim() || undefined;

function settings() {
  const host = clean(process.env.SMTP_HOST) ?? 'smtp.gmail.com';
  const port = Number(clean(process.env.SMTP_PORT) ?? 465);
  const user = clean(process.env.SMTP_USER);
  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop"); the spaces aren't part of it.
  const rawPass = clean(process.env.SMTP_PASS);
  const pass = host === 'smtp.gmail.com' ? rawPass?.replace(/\s+/g, '') : rawPass;
  const fromAddress = clean(process.env.EMAIL_FROM) ?? (user?.includes('@') ? `"${EVENT.series}" <${user}>` : undefined);
  const replyTo = clean(process.env.EMAIL_REPLY_TO);
  return { host, port, user, pass, from: fromAddress, replyTo };
}

export function emailConfigured() {
  const s = settings();
  return Boolean(s.user && s.pass && s.from);
}

/** For /api/health — never includes the password. */
export function emailStatus() {
  const s = settings();
  const problem =
    !s.user || !s.pass
      ? 'Add SMTP_USER and SMTP_PASS to send confirmation emails.'
      : !s.from
        ? 'Set EMAIL_FROM: SMTP_USER is not an email address.'
        : undefined;
  return { configured: !problem, server: `${s.host}:${s.port}`, ...(problem ? { problem } : {}) };
}

let cached: { key: string; transport: Transporter } | undefined;
function transport() {
  const s = settings();
  const key = `${s.host}|${s.port}|${s.user}|${s.pass}`;
  if (cached?.key !== key) {
    cached = {
      key,
      transport: nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.port === 465, // 465 = TLS from the start; 587/25 upgrade with STARTTLS
        auth: { user: s.user!, pass: s.pass! },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
    };
  }
  return cached.transport;
}

/** Public address of the site for links in the email. */
export function siteUrl(req?: Request) {
  const explicit = clean(process.env.SITE_URL);
  if (explicit) return explicit.replace(/\/+$/, '');
  const production = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return `https://${production}`;
  return req ? new URL(req.url).origin : 'https://tm241-fireside-chat.vercel.app';
}

// ---------------------------------------------------------------- images

const FILES: Record<Exclude<EmailImage, 'qr'>, { file: string; type: string }> = {
  hero: { file: 'hero.jpg', type: 'image/jpeg' },
  /** The same header art for online registrants: "Online · Live on Zoom" and "See you online". */
  'hero-online': { file: 'hero-online.jpg', type: 'image/jpeg' },
  /** Header for updates organizers write: no date, time or venue, so it never goes out of date. */
  'hero-update': { file: 'hero-update.jpg', type: 'image/jpeg' },
  /** Header of the certificate email. */
  'hero-thanks': { file: 'hero-thanks.jpg', type: 'image/jpeg' },
  /** The event logo (transparent, 2x) for the boarding pass title; rendered from components/EventLogo.tsx. */
  logo: { file: 'logo.png', type: 'image/png' },
  'icon-calendar': { file: 'icon-calendar.png', type: 'image/png' },
  'icon-clock': { file: 'icon-clock.png', type: 'image/png' },
  'icon-pin': { file: 'icon-pin.png', type: 'image/png' },
  'icon-scan': { file: 'icon-scan.png', type: 'image/png' },
  'icon-video': { file: 'icon-video.png', type: 'image/png' },
  /** The Zoom app logo (2x), inside the Join on Zoom button. */
  zoom: { file: 'zoom.png', type: 'image/png' },
};
const art = new Map<string, Buffer>();

/** Loads the images one email uses — only those are attached. */
async function images(names: EmailImage[], ref: string) {
  const out = {} as Record<EmailImage, { content: Buffer; type: string; file: string }>;
  for (const name of names) {
    if (name === 'qr') {
      out.qr = { content: qrPng(ref), type: 'image/png', file: `${ref}.png` };
      continue;
    }
    const { file, type } = FILES[name];
    let content = art.get(file);
    if (!content) {
      content = await readFile(path.join(process.cwd(), 'public', 'email', file));
      art.set(file, content);
    }
    out[name] = { content, type, file };
  }
  return out;
}

const cid = (name: EmailImage) => `${name}@tm241-fireside-chat`;

// ---------------------------------------------------------------- sending

export function ticketDataFrom(
  r: Pick<Registration, 'ref' | 'name' | 'email' | 'organization' | 'affiliation' | 'affiliationOther' | 'question' | 'attendanceMode'>,
): TicketEmailData {
  const online = r.attendanceMode === 'Online';
  return {
    ref: r.ref,
    name: r.name,
    email: r.email,
    organization: r.organization,
    affiliation: r.affiliation === 'Other' ? r.affiliationOther || 'Other' : r.affiliation,
    question: r.question,
    attendanceMode: online ? 'Online' : 'Onsite',
    joinUrl: online ? zoomJoinUrl() : null,
  };
}

/** One email out: inline pictures, and the calendar invite when asked for. */
async function deliver(
  d: TicketEmailData,
  mail: { subject: string; html: string; text: string },
  opts: { images: EmailImage[]; invite: boolean; to?: string; files?: { filename: string; content: Buffer; contentType: string }[] },
) {
  const s = settings();
  if (!emailConfigured()) throw new EmailNotConfigured();
  const img = await images(opts.images, d.ref);
  const message: SendMailOptions = {
    from: s.from,
    to: opts.to ?? { name: d.name, address: d.email },
    ...(s.replyTo ? { replyTo: s.replyTo } : {}),
    ...mail,
    attachments: [
      ...opts.images.map((n) => ({
        filename: img[n].file,
        content: img[n].content,
        contentType: img[n].type,
        cid: cid(n),
        contentDisposition: 'inline' as const,
      })),
      ...(opts.invite
        ? [
            {
              filename: inviteFileName(d.ref),
              content: buildInvite({
                ref: d.ref,
                name: d.name,
                organization: d.organization,
                online: isOnline(d),
                joinUrl: d.joinUrl,
              }),
              contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
            },
          ]
        : []),
      ...(opts.files ?? []),
    ],
  };
  const info = await transport().sendMail(message);
  return { messageId: info.messageId as string | undefined };
}

/** Sends the boarding-pass email. Throws when the mail server refuses it. */
export function sendTicketEmail(d: TicketEmailData, opts: { siteUrl: string; to?: string }) {
  const mail = renderTicketEmail(d, { siteUrl: opts.siteUrl, src: (n) => `cid:${cid(n)}` });
  return deliver(d, mail, { images: emailImagesFor(d), invite: true, to: opts.to });
}

/** Sends an update an organizer wrote to one person. Throws when the mail server refuses it. */
export function sendUpdateEmail(u: UpdateContent, d: TicketEmailData, opts: { siteUrl: string; to?: string }) {
  const mail = renderUpdateEmail(u, d, { siteUrl: opts.siteUrl, src: (n) => `cid:${cid(n)}` });
  return deliver(d, mail, { images: updateImagesFor(u, d), invite: u.attachInvite, to: opts.to });
}

/** Sends the Certificate of Participation, with the PDF attached. Throws when the mail server refuses it. */
export function sendCertificateEmail(c: CertificateEmailData, pdf: Buffer, opts: { siteUrl: string }) {
  const d: TicketEmailData = { ref: c.number, name: c.name, email: c.email, organization: '', affiliation: '' };
  const file = certificateFileName(c.name);
  const mail = renderCertificateEmail(c, { siteUrl: opts.siteUrl, src: (n) => `cid:${cid(n)}` }, file);
  return deliver(d, mail, { images: CERTIFICATE_IMAGES, invite: false, files: [{ filename: file, content: pdf, contentType: 'application/pdf' }] });
}

/**
 * After a registration is saved: send the email once the response has gone back to the browser,
 * so the registrant never waits on the mail server and a mail problem never fails the registration.
 * Returns whether an email was queued.
 */
export function queueTicketEmail(d: TicketEmailData, req: Request) {
  try {
    if (!emailConfigured()) return false;
    const url = siteUrl(req);
    after(async () => {
      try {
        await sendTicketEmail(d, { siteUrl: url });
        console.info(`[email] boarding pass sent for ${d.ref}`);
      } catch (e) {
        console.error(`[email] could not send the boarding pass for ${d.ref}:`, describeEmailError(e));
      }
    });
    return true;
  } catch (e) {
    // The registration is already saved — never report it as failed because of the email.
    console.error(`[email] could not queue the boarding pass for ${d.ref}:`, e);
    return false;
  }
}

/** HTML for the dashboard's preview: same email, with the images inlined. */
export async function previewTicketEmail(d: TicketEmailData, url: string) {
  const img = await images(emailImagesFor(d), d.ref);
  return renderTicketEmail(d, {
    siteUrl: url,
    src: (n) => `data:${img[n].type};base64,${img[n].content.toString('base64')}`,
  });
}

/**
 * HTML of an update for the page's live preview: the pictures come from the site itself (only the
 * sample QR code is inlined), so re-rendering on every edit stays light.
 */
export function previewUpdateEmail(u: UpdateContent, d: TicketEmailData, opts: { siteUrl: string; origin: string }) {
  return renderUpdateEmail(u, d, {
    siteUrl: opts.siteUrl,
    src: (n) => (n === 'qr' ? `data:image/png;base64,${qrPng(d.ref).toString('base64')}` : `${opts.origin}/email/${FILES[n].file}`),
  });
}

export class EmailNotConfigured extends Error {
  constructor() {
    super('Email is not set up yet. Add SMTP_USER and SMTP_PASS in Vercel, then redeploy.');
  }
}

type MailError = { code?: string; responseCode?: number; message?: string; response?: string };
const overLimit = (err: MailError) => /\b5\.4\.5\b|sending limit|too many (messages|recipients|login)/i.test(`${err.response ?? ''} ${err.message ?? ''}`);

/**
 * True when the mail account itself is the problem (sign-in, connection, daily limit), so trying the
 * next person would fail the same way. False when only this one address was refused.
 */
export function stopsSending(e: unknown) {
  if (e instanceof EmailNotConfigured) return true;
  const err = e as MailError;
  return (
    overLimit(err) ||
    ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(err.code ?? '') ||
    [421, 450, 451, 452, 454, 534, 535].includes(err.responseCode ?? 0)
  );
}

/** A message an organizer can act on, without echoing anything secret. */
export function describeEmailError(e: unknown) {
  if (e instanceof EmailNotConfigured) return e.message;
  const err = e as MailError;
  if (overLimit(err)) return 'The mail account reached its sending limit for now. Try again later (Gmail resets within 24 hours).';
  if (err.code === 'EAUTH' || err.responseCode === 535 || err.responseCode === 534)
    return 'The mail server rejected the sign-in. Check SMTP_USER and SMTP_PASS (for Gmail, use an App password, not the normal password).';
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION' || err.code === 'ESOCKET' || err.code === 'EDNS')
    return 'Could not reach the mail server. Check SMTP_HOST and SMTP_PORT.';
  if (err.code === 'EENVELOPE' || err.responseCode === 550 || err.responseCode === 553)
    return 'The mail server refused the address. Check the registrant’s email address.';
  if (err.responseCode === 421 || err.responseCode === 450 || err.responseCode === 451 || err.responseCode === 452 || err.responseCode === 454)
    return 'The mail server is busy or the daily sending limit was reached. Try again later.';
  return `The email could not be sent (${err.code ?? err.responseCode ?? 'unknown error'}).`;
}
