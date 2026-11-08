'use client';

import { useEffect, useState } from 'react';
import { EVENT } from '@/lib/config';

const START = Date.parse(EVENT.startsAt);
const END = Date.parse(EVENT.endsAt);

const UNITS = [
  { key: 'd', label: 'Days', ms: 86_400_000 },
  { key: 'h', label: 'Hours', ms: 3_600_000 },
  { key: 'm', label: 'Min', ms: 60_000 },
  { key: 's', label: 'Sec', ms: 1000 },
] as const;

function split(ms: number) {
  let rest = Math.max(0, ms);
  return UNITS.map((u) => {
    const v = Math.floor(rest / u.ms);
    rest -= v * u.ms;
    return { ...u, v };
  });
}

/** Mission-control countdown to the Fireside Chat (Philippine time). Renders nothing until mounted. */
export default function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (now === null) return <div className="countdown is-pending" aria-hidden="true" />;

  if (now >= END) {
    return <p className="countdown-note">Thank you to everyone who joined us — see you at the next Fireside Chat!</p>;
  }
  if (now >= START) {
    return (
      <p className="countdown-note is-live">
        <span className="live-dot" aria-hidden="true" />
        Liftoff — the Fireside Chat is happening now
      </p>
    );
  }

  const parts = split(START - now);
  const days = parts[0].v;
  return (
    <div className="countdown" role="timer" aria-label={`${days} days until the Fireside Chat`}>
      <p className="countdown-label">
        <span className="tminus">T-minus</span> to liftoff
      </p>
      <ol className="countdown-tiles" aria-hidden="true">
        {parts.map((p) => (
          <li key={p.key}>
            <b key={p.v}>{String(p.v).padStart(2, '0')}</b>
            <span>{p.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
