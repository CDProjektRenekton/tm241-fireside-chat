'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import GradientCanvas from './GradientCanvas';
import EventLogo from './EventLogo';
import { SPLASH_NEBULA } from './nebula';

const SHOW_MS = 5200;
const SHOW_MS_REPEAT = 2300; // shorter when the visitor has already seen it in this tab
const SHOW_MS_REDUCED = 1200;
// The fade-out (splash-out) lasts 1 s; unmount a little after it ends so the splash is never
// removed while still faintly visible.
const LEAVE_MS = 1150;
const SEEN_KEY = 'tm241-fc-splash-seen';

type Phase = 'show' | 'leaving' | 'gone';

/**
 * Hyperspace intro: the star field streaks past, orbit rings draw around the UP and TMC seals,
 * the "Leading from the Start" logo assembles ("Liftoff": the chevron A launches, the lettering
 * follows, a comet draws the orbit and lights the star — see app/splash-logo.css), a launch bar
 * counts down, then everything jumps to warp and the form is revealed. Click, tap, Enter, Space
 * or Escape skips it.
 */
export default function Splash() {
  const [phase, setPhase] = useState<Phase>('show');
  const [quick, setQuick] = useState(false);
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
    if (seen) setQuick(true);
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
    // Lock scrolling and pause the hidden backdrop while the splash covers the page. These touch
    // only <html>'s inline overflow and the .space element — toggling classes on <html> would make
    // the browser re-check the styles of the entire page right in the middle of the transition.
    document.documentElement.style.overflow = phase === 'show' ? 'hidden' : '';
    document.querySelector('.space')?.classList.toggle('is-paused', phase === 'show');
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
    // Motion streaks don't need full density: 1.5× on larger screens, 1× on phones (the canvas is
    // re-uploaded to the GPU every frame, so its pixel count matters most on mobile).
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1 : 1.5);
    const resize = () => {
      const nw = window.innerWidth;
      const nh = window.innerHeight;
      // Resizing a canvas wipes it, which can flash a blank frame. Skip no-op resizes and small
      // height-only changes (a phone's address bar sliding in/out); CSS stretches the canvas to fit.
      if (w && nw === w && Math.abs(nh - h) < 160) return;
      w = nw;
      h = nh;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Streaks are drawn in batches: one path per colour × brightness band (4 × 4 = 16 strokes per
    // frame) instead of one stroke per star.
    const COLORS = ['255,255,255', '173,227,242', '138,209,226', '242,112,124'];
    const COLOR_ODDS = [0, 0, 0, 1, 2, 3]; // mostly white, some cyan, a little coral
    const BANDS = [
      { alpha: 0.3, width: 0.7 },
      { alpha: 0.55, width: 1.2 },
      { alpha: 0.82, width: 1.8 },
      { alpha: 1, width: 2.6 },
    ];
    const STYLES = COLORS.map((c) => BANDS.map((b) => `rgba(${c},${b.alpha})`));
    const batches: number[][] = Array.from({ length: COLORS.length * BANDS.length }, () => []);

    const count = Math.min(520, Math.round((w * h) / 2600));
    const spawn = (z = Math.random()) => ({
      x: (Math.random() * 2 - 1) * 1.2,
      y: (Math.random() * 2 - 1) * 1.2,
      z: Math.max(0.02, z),
      pz: Math.max(0.02, z),
      c: COLOR_ODDS[Math.floor(Math.random() * COLOR_ODDS.length)],
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
      // The splash unmounts its canvas when it finishes; stop drawing instead of looping forever.
      if (!canvas.isConnected) return;
      const dt = Math.min(48, now - last) / 16.67;
      last = now;
      speed += (target(now - start) - speed) * (warpRef.current ? 0.08 : 0.12);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const fov = Math.max(w, h) * 0.5;
      for (const b of batches) b.length = 0;
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
        const band = Math.min(BANDS.length - 1, Math.floor((1 - s.z) * BANDS.length));
        // Keep a minimum length so slow stars still read as points.
        batches[s.c * BANDS.length + band].push(px, py, sx + (sx === px ? 0.6 : 0), sy + (sy === py ? 0.6 : 0));
      }
      ctx.lineCap = 'round';
      for (let i = 0; i < batches.length; i++) {
        const seg = batches[i];
        if (!seg.length) continue;
        ctx.strokeStyle = STYLES[Math.floor(i / BANDS.length)][i % BANDS.length];
        ctx.lineWidth = BANDS[i % BANDS.length].width;
        ctx.beginPath();
        for (let k = 0; k < seg.length; k += 4) {
          ctx.moveTo(seg[k], seg[k + 1]);
          ctx.lineTo(seg[k + 2], seg[k + 3]);
        }
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

  return (
    <div
      className={`splash${quick ? ' is-quick' : ''}${phase === 'leaving' ? ' is-leaving' : ''}`}
      onClick={skip}
      role="status"
      aria-live="polite"
      aria-label="Loading the TM241 Fireside Chat registration form"
    >
      <div className="splash-nebula">
        {SPLASH_NEBULA.map((n) => (
          <GradientCanvas key={n.className} className={n.className} blobs={n.blobs} aspect={n.aspect} width={n.width} />
        ))}
      </div>
      <canvas className="splash-warp" ref={canvasRef} />
      <div className="splash-halftones">
        <div className="splash-halftone splash-halftone-tr" />
        <div className="splash-halftone splash-halftone-bl" />
      </div>

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
        <h1 className="splash-title">
          <span className="sr-only">{EVENT.title}</span>
          <EventLogo variant="splash" />
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
