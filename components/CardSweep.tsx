'use client';

import { useEffect, useRef } from 'react';

// Same stops as the original CSS conic-gradient: a cyan light and a coral light, opposite each other.
const STOPS: [number, string][] = [
  [0, 'rgba(138,209,226,0)'],
  [40, 'rgba(138,209,226,0.9)'],
  [90, 'rgba(138,209,226,0)'],
  [200, 'rgba(242,112,124,0)'],
  [240, 'rgba(242,112,124,0.7)'],
  [290, 'rgba(242,112,124,0)'],
  [360, 'rgba(242,112,124,0)'],
];

/** Colour at a given angle (degrees), for browsers without createConicGradient. */
function colorAt(deg: number) {
  for (let i = 1; i < STOPS.length; i++) {
    const [a1, c1] = STOPS[i];
    const [a0, c0] = STOPS[i - 1];
    if (deg <= a1) {
      const t = (deg - a0) / (a1 - a0 || 1);
      const p = c0.match(/[\d.]+/g)!.map(Number);
      const q = c1.match(/[\d.]+/g)!.map(Number);
      const mix = p.map((v, k) => v + (q[k] - v) * t);
      return `rgba(${mix[0].toFixed(0)},${mix[1].toFixed(0)},${mix[2].toFixed(0)},${mix[3].toFixed(3)})`;
    }
  }
  return STOPS[STOPS.length - 1][1];
}

/**
 * The slow cyan/coral light that travels around a glass card's border (styled in globals.css).
 *
 * Performance: the rotating light is a 256 px texture drawn once; CSS stretches it to cover the
 * card and the GPU spins it. Previously it was a ~2000 px square re-rasterized at full device
 * resolution — on a 3× phone screen that was the single most expensive thing on the page.
 */
export default function CardSweep() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const s = canvas.width;
    const c = s / 2;
    ctx.clearRect(0, 0, s, s);
    if (typeof ctx.createConicGradient === 'function') {
      // CSS conic gradients start at 12 o'clock; canvas ones at 3 o'clock.
      const g = ctx.createConicGradient(-Math.PI / 2, c, c);
      for (const [deg, color] of STOPS) g.addColorStop(deg / 360, color);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    } else {
      // Fallback: thin wedges.
      for (let deg = 0; deg < 360; deg += 1) {
        const a0 = ((deg - 90) * Math.PI) / 180;
        const a1 = ((deg + 1.5 - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, s, a0, a1);
        ctx.closePath();
        ctx.fillStyle = colorAt(deg);
        ctx.fill();
      }
    }
  }, []);

  return (
    <span className="card-sweep" aria-hidden="true">
      <canvas ref={ref} width={256} height={256} />
    </span>
  );
}
