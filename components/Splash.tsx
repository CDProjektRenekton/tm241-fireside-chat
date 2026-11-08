'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';

const SHOW_MS = 5200;
const SHOW_MS_REPEAT = 2300; // shorter when the visitor has already seen it in this tab
const SHOW_MS_REDUCED = 1200;
const LEAVE_MS = 1000;
const SEEN_KEY = 'tm241-fc-splash-seen';

const TITLE = ['Leading', 'from', 'the', 'Start'];

type Phase = 'show' | 'leaving' | 'gone';

/**
 * Hyperspace intro: the star field streaks past, orbit rings draw around the UP and TMC seals,
 * "Leading from the Start" rises letter by letter, a launch bar counts down, then everything
 * jumps to warp and the form is revealed. Click, tap, Enter, Space or Escape skips it.
 */
export default function Splash() {
  const [phase, setPhase] = useState<Phase>('show');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warpRef = useRef(0); // 0 = cruise, 1 = jump to warp (leaving)

  const skip = useCallback(() => setPhase((p) => (p === 'show' ? 'leaving' : p)), []);

  // Timeline + skip keys.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
    if (seen) document.documentElement.classList.add('splash-quick');
    const t = window.setTimeout(skip, reduce ? SHOW_MS_REDUCED : seen ? SHOW_MS_REPEAT : SHOW_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [skip]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('splash-active', phase === 'show');
    if (phase === 'gone') root.classList.remove('splash-quick');
    if (phase !== 'leaving') return;
    warpRef.current = 1;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    const t = window.setTimeout(() => setPhase('gone'), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Hyperspace star field.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['255,255,255', '255,255,255', '255,255,255', '173,227,242', '138,209,226', '242,112,124'];
    const count = Math.min(520, Math.round((w * h) / 2600));
    const spawn = (z = Math.random()) => ({
      x: (Math.random() * 2 - 1) * 1.2,
      y: (Math.random() * 2 - 1) * 1.2,
      z: Math.max(0.02, z),
      pz: Math.max(0.02, z),
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    const stars = Array.from({ length: count }, () => spawn());

    const start = performance.now();
    let last = start;
    let speed = 0;
    let raf = 0;

    const target = (t: number) => {
      if (warpRef.current) return 0.075;
      if (reduce) return 0.0015;
      // Burst into hyperspace, then ease down to a gentle cruise while the title shows.
      if (t < 900) return 0.004 + (t / 900) * 0.034;
      if (t < 2200) return 0.038 - ((t - 900) / 1300) * 0.032;
      return 0.006;
    };

    const frame = (now: number) => {
      const dt = Math.min(48, now - last) / 16.67;
      last = now;
      speed += (target(now - start) - speed) * (warpRef.current ? 0.08 : 0.12);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const fov = Math.max(w, h) * 0.5;
      for (const s of stars) {
        s.pz = s.z;
        s.z -= speed * dt;
        if (s.z <= 0.02) {
          Object.assign(s, spawn(1));
          continue;
        }
        const sx = cx + (s.x / s.z) * fov;
        const sy = cy + (s.y / s.z) * fov;
        const px = cx + (s.x / s.pz) * fov;
        const py = cy + (s.y / s.pz) * fov;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
          Object.assign(s, spawn(1));
          continue;
        }
        const near = 1 - s.z;
        ctx.strokeStyle = `rgba(${s.c},${Math.min(1, near * 1.25)})`;
        ctx.lineWidth = Math.max(0.6, near * 2.6);
        ctx.beginPath();
        ctx.moveTo(px, py);
        // Keep a minimum length so slow stars still read as points.
        ctx.lineTo(sx + (sx === px ? 0.6 : 0), sy + (sy === py ? 0.6 : 0));
        ctx.stroke();
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (phase === 'gone') return null;

  let letter = 0;
  return (
    <div
      className={`splash${phase === 'leaving' ? ' is-leaving' : ''}`}
      onClick={skip}
      role="status"
      aria-live="polite"
      aria-label="Loading the TM241 Fireside Chat registration form"
    >
      <div className="splash-nebula">
        <span />
        <span />
        <span />
      </div>
      <canvas className="splash-warp" ref={canvasRef} />
      <div className="splash-halftone splash-halftone-tr" />
      <div className="splash-halftone splash-halftone-bl" />

      <div className="splash-content">
        <div className="splash-orbit">
          <svg className="orbit-rings" viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ade3f2" />
                <stop offset="0.55" stopColor="#5eb6d3" />
                <stop offset="1" stopColor="#f2707c" />
              </linearGradient>
            </defs>
            <circle className="ring ring-1" cx="200" cy="200" r="190" />
            <circle className="ring ring-2" cx="200" cy="200" r="160" />
            <ellipse className="ring ring-3" cx="200" cy="200" rx="196" ry="70" transform="rotate(-18 200 200)" />
          </svg>
          <span className="orbit-sat" aria-hidden="true">
            <i />
          </span>
          <span className="orbit-sat orbit-sat-2" aria-hidden="true">
            <i />
          </span>
          <div className="splash-logos">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/up-seal.png" alt="University of the Philippines" width={480} height={480} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} />
          </div>
        </div>

        <p className="splash-kicker">
          <span>{EVENT.series}</span>
        </p>
        <h1 className="splash-title" aria-label={EVENT.title}>
          {TITLE.map((word) => (
            <span className="splash-word" key={word} aria-hidden="true">
              {[...word].map((ch) => (
                <b key={letter} style={{ '--i': letter++ } as React.CSSProperties}>
                  {ch}
                </b>
              ))}
            </span>
          ))}
        </h1>
        <p className="splash-sub">{EVENT.subtitle}</p>

        <div className="splash-launch" aria-hidden="true">
          <span className="launch-label">
            <i className="launch-dot" />
            Preparing for liftoff
          </span>
          <span className="launch-bar">
            <i />
          </span>
          <span className="launch-date">
            {EVENT.dateShort} · UP Diliman
          </span>
        </div>
      </div>

      <div className="splash-flash" />
      <p className="splash-skip">Tap or press Enter to skip</p>
    </div>
  );
}
