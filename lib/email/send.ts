import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { after } from 'next/server';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { EVENT } from '../config';
import { buildInvite, inviteFileName } from '../ics';
import type { Registration } from '../types';
import { qrPng } from './qr-png';
import { EMAIL_IMAGES, renderTicketEmail, type EmailImage, type TicketEmailData } from './template';

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
  /** The event logo (transparent, 2x) for the boarding pass title; rendered from components/EventLogo.tsx. */
  logo: { file: 'logo.png', type: 'image/png' },
  'icon-calendar': { file: 'icon-calendar.png', type: 'image/png' },
  'icon-clock': { file: 'icon-clock.png', type: 'image/png' },
  'icon-pin': { file: 'icon-pin.png', type: 'image/png' },
  'icon-scan': { file: 'icon-scan.png', type: 'image/png' },
};
const art = new Map<string, Buffer>();

async function images(ref: string) {
  const out = {} as Record<EmailImage, { content: Buffer; type: string; file: string }>;
  for (const name of EMAIL_IMAGES) {
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

export function ticketDataFrom(r: Pick<Registration, 'ref' | 'name' | 'email' | 'organization' | 'affiliation' | 'affiliationOther' | 'question'>): TicketEmailData {
  return {
    ref: r.ref,
    name: r.name,
    email: r.email,
    organization: r.organization,
    affiliation: r.affiliation === 'Other' ? r.affiliationOther || 'Other' : r.affiliation,
    question: r.question,
  };
}

/** Sends the boarding-pass email. Throws when the mail server refuses it. */
export async function sendTicketEmail(d: TicketEmailData, opts: { siteUrl: string; to?: string }) {
  const s = settings();
  if (!emailConfigured()) throw new EmailNotConfigured();
  const img = await images(d.ref);
  const { subject, html, text } = renderTicketEmail(d, { siteUrl: opts.siteUrl, src: (n) => `cid:${cid(n)}` });
  const message: SendMailOptions = {
    from: s.from,
    to: opts.to ?? { name: d.name, address: d.email },
    ...(s.replyTo ? { replyTo: s.replyTo } : {}),
    subject,
    html,
    text,
    attachments: [
      ...EMAIL_IMAGES.map((n) => ({
        filename: img[n].file,
        content: img[n].content,
        contentType: img[n].type,
        cid: cid(n),
        contentDisposition: 'inline' as const,
      })),
      {
        filename: inviteFileName(d.ref),
        content: buildInvite({ ref: d.ref, name: d.name, organization: d.organization }),
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  };
  const info = await transport().sendMail(message);
  return { messageId: info.messageId as string | undefined };
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
  const img = await images(d.ref);
  return renderTicketEmail(d, {
    siteUrl: url,
    src: (n) => `data:${img[n].type};base64,${img[n].content.toString('base64')}`,
  });
}

export class EmailNotConfigured extends Error {
  constructor() {
    super('Email is not set up yet. Add SMTP_USER and SMTP_PASS in Vercel, then redeploy.');
  }
}

/** A message an organizer can act on, without echoing anything secret. */
export function describeEmailError(e: unknown) {
  if (e instanceof EmailNotConfigured) return e.message;
  const err = e as { code?: string; responseCode?: number; message?: string };
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
