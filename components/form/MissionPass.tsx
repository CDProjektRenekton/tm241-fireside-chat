'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { EVENT } from '@/lib/config';
import { buildInvite, inviteFileName } from '@/lib/ics';
import type { RegistrationInput } from '@/lib/types';
import { ticketPayload } from '@/lib/ticket';
import { Check, Copy, Sparkle } from '../Icons';
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
}

/** The "boarding pass" for the Fireside Chat: a live preview before submitting, the real pass afterwards. */
export function MissionPass({ data, refNo }: PassProps) {
  const affiliation = affiliationText(data);
  return (
    <article className={`pass${refNo ? ' is-issued' : ' is-preview'}`} aria-label="Fireside Chat boarding pass">
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
          <h3 className="pass-title">{EVENT.title}</h3>
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
              <dd>SURP · UP Diliman</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="pass-stub">
        <span className="pass-perf" aria-hidden="true" />
        <span className="pass-label">Reference No.</span>
        <strong className="pass-ref">{refNo ?? 'Pending'}</strong>
        {refNo ? (
          <TicketQR className="pass-qr" value={ticketPayload(refNo)} />
        ) : (
          <span className="pass-qr is-pending">QR code appears after you register</span>
        )}
        <span className="pass-admit">Admit one</span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- calendar invite

export function downloadInvite(refNo: string, data: RegistrationInput) {
  const ics = buildInvite({ ref: refNo, name: data.name, organization: data.organization });
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
