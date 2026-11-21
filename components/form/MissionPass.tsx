'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { EVENT } from '@/lib/config';
import { buildInvite, inviteFileName } from '@/lib/ics';
import type { RegistrationInput } from '@/lib/types';
import { ticketPayload } from '@/lib/ticket';
import EventLogo from '../EventLogo';
import { Check, Copy, External, Sparkle, ZoomLogo } from '../Icons';
import TicketQR from '../TicketQR';

export function affiliationText(d: Pick<RegistrationInput, 'affiliation' | 'affiliationOther'>) {
  return d.affiliation === 'Other' ? d.affiliationOther || 'Other' : d.affiliation;
}

export function CopyRef({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
      {copied ? 'Copied' : 'Copy reference'}
    </button>
  );
}

interface PassProps {
  data: RegistrationInput;
  refNo?: string;
  /** Online registrants: the Zoom link, shown in place of the QR code once registered. */
  joinUrl?: string | null;
}

/** Copies the Zoom link, for people who join from another device. */
function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pass-zoom-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? <Check width={16} height={16} /> : <ZoomLogo size={16} />}
      {copied ? 'Link copied' : 'Copy Zoom link'}
    </button>
  );
}

/** Where the QR code goes on an onsite pass: the Zoom button (or a note while there is none yet). */
function ZoomStub({ refNo, joinUrl }: { refNo?: string; joinUrl?: string | null }) {
  if (!refNo) {
    return (
      <span className="pass-qr is-pending pass-zoom-pending">
        <ZoomLogo size={30} />
        Zoom link appears after you register
      </span>
    );
  }
  if (!joinUrl) {
    return (
      <span className="pass-qr is-pending pass-zoom-pending">
        <ZoomLogo size={30} />
        Your Zoom link will be sent by email before the event
      </span>
    );
  }
  return (
    <div className="pass-zoom">
      <a className="btn btn-primary pass-zoom-btn" href={joinUrl} target="_blank" rel="noopener noreferrer">
        <ZoomLogo size={24} />
        Join on Zoom
        <External width={16} height={16} />
      </a>
      <span className="pass-zoom-when">
        <span>Opens {EVENT.time.split(' – ')[0]}</span> <span>{EVENT.weekday.slice(0, 3)} {EVENT.dateShort}</span>
      </span>
      <CopyLink value={joinUrl} />
      {/* on paper, the link itself */}
      <span className="pass-zoom-url print-only">{joinUrl}</span>
    </div>
  );
}

/** The "boarding pass" for the Fireside Chat: a live preview before submitting, the real pass afterwards. */
export function MissionPass({ data, refNo, joinUrl }: PassProps) {
  const affiliation = affiliationText(data);
  const online = data.attendanceMode === 'Online';
  return (
    <article
      className={`pass${refNo ? ' is-issued' : ' is-preview'}${online ? ' is-online' : ''}`}
      aria-label="Fireside Chat boarding pass"
    >
      <div className="pass-main">
        <header className="pass-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/up-seal.png" alt="University of the Philippines" width={480} height={480} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} />
          <span className="pass-tag">
            <Sparkle width={12} height={12} />
            Boarding pass
          </span>
        </header>
        {refNo && <span className="pass-stamp">Cleared for liftoff</span>}
        <div className="pass-body">
          <p className="pass-kicker">{EVENT.series}</p>
          <h3 className="pass-title">
            <span className="sr-only">{EVENT.title}</span>
            <EventLogo variant="pass" />
          </h3>
          <div className="pass-passenger">
            <span className="pass-label">Passenger</span>
            <strong className="pass-name">{data.name || 'Your name'}</strong>
            <span className="pass-org">
              {data.organization || 'University / Organization'}
              {affiliation && <em>{affiliation}</em>}
            </span>
          </div>
          <dl className="pass-meta">
            <div>
              <dt>Date</dt>
              <dd>{EVENT.dateShort}</dd>
            </div>
            <div>
              <dt>Boarding</dt>
              <dd>{EVENT.time.split(' – ')[0]}</dd>
            </div>
            <div className="pass-gate">
              <dt>Gate</dt>
              <dd>
                {online ? (
                  <>
                    Online · <span>Live on Zoom</span>
                  </>
                ) : (
                  <>
                    {EVENT.venue} · <span>UP Diliman</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="pass-stub">
        <span className="pass-perf" aria-hidden="true" />
        <span className="pass-label">Reference No.</span>
        <strong className="pass-ref">{refNo ?? 'Pending'}</strong>
        {online ? (
          <ZoomStub refNo={refNo} joinUrl={joinUrl} />
        ) : refNo ? (
          <TicketQR className="pass-qr" value={ticketPayload(refNo)} />
        ) : (
          <span className="pass-qr is-pending">QR code appears after you register</span>
        )}
        <span className="pass-admit">{online ? 'Joining online' : 'Admit one'}</span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- calendar invite

export function downloadInvite(refNo: string, data: RegistrationInput, joinUrl?: string | null) {
  const ics = buildInvite({
    ref: refNo,
    name: data.name,
    organization: data.organization,
    online: data.attendanceMode === 'Online',
    joinUrl,
  });
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = inviteFileName(refNo);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- liftoff celebration

const DUST_COLORS = ['#ffffff', '#ade3f2', '#5eb6d3', '#f2707c', '#8ff0cf', '#a7b4ff'];
// Fixed pseudo-random spread so the burst looks the same every time.
const DUST = Array.from({ length: 48 }, (_, i) => ({
  a: (i * 137.5) % 360,
  r: 22 + ((i * 53) % 34),
  delay: ((i * 29) % 40) / 100,
  dur: 1.4 + ((i * 17) % 12) / 10,
  size: 3 + (i % 4) * 2,
  color: DUST_COLORS[i % DUST_COLORS.length],
  star: i % 5 === 0,
}));

/** A rocket lifts off from the bottom of the screen and bursts into stardust. Rendered into <body>. */
export function Liftoff() {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="liftoff" aria-hidden="true">
      <div className="liftoff-rocket">
        <svg viewBox="0 0 64 128">
          <defs>
            <linearGradient id="rocketBody" x1="0" x2="1">
              <stop offset="0" stopColor="#cfefff" />
              <stop offset="0.5" stopColor="#ffffff" />
              <stop offset="1" stopColor="#9ccbe0" />
            </linearGradient>
            <linearGradient id="rocketFlame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff6c8" />
              <stop offset="0.4" stopColor="#f2707c" />
              <stop offset="1" stopColor="#f2707c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="rocket-flame" d="M24 92 Q32 128 40 92 Z" fill="url(#rocketFlame)" />
          <path d="M32 4 C46 18 50 40 48 70 L48 88 L16 88 L16 70 C14 40 18 18 32 4 Z" fill="url(#rocketBody)" />
          <circle cx="32" cy="44" r="7" fill="#0b1040" stroke="#5eb6d3" strokeWidth="3" />
          <path d="M16 66 L4 84 L4 94 L16 88 Z M48 66 L60 84 L60 94 L48 88 Z" fill="#e8475a" />
          <path d="M26 88 h12 v6 h-12 z" fill="#5d6b8f" />
        </svg>
        <span className="liftoff-trail" />
      </div>
      <div className="stardust">
        {DUST.map((d, i) => (
          <i
            key={i}
            className={d.star ? 'is-star' : undefined}
            style={
              {
                '--a': `${d.a}deg`,
                '--r': `${d.r}vmin`,
                width: d.size,
                height: d.size,
                background: d.color,
                animationDelay: `${1.05 + d.delay}s`,
                animationDuration: `${d.dur}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
