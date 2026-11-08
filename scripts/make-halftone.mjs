#!/usr/bin/env node
// Generates public/halftone.svg — the polar halftone arc from the "Leading from the Start" pubmat:
// dots are largest along the inner arc and shrink toward the corner. Run: node scripts/make-halftone.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 600;
const C = { x: 700, y: -120 }; // circle centre, beyond the top-right corner
const EDGE = 640; // radius of the inner arc (biggest dots)
const BAND = 360; // how far the dots reach toward the centre
const STEP = 13;
const MAX_R = 4.7;

const dots = [];
for (let k = 0; k * STEP <= BAND; k++) {
  const d = EDGE - k * STEP;
  const t = k / (BAND / STEP);
  const r = MAX_R * Math.pow(1 - t, 1.35);
  if (r < 0.35) continue;
  const da = STEP / d;
  // Stagger alternate rings for a tighter weave.
  for (let a = Math.PI / 2 + (k % 2) * (da / 2); a < Math.PI * 1.25; a += da) {
    const x = C.x + d * Math.cos(a);
    const y = C.y + d * Math.sin(a);
    if (x < -r || y < -r || x > SIZE + r || y > SIZE + r) continue;
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"/>`);
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" fill="#fff">${dots.join('')}</svg>\n`;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'halftone.svg');
writeFileSync(out, svg);
console.log(`halftone.svg: ${dots.length} dots, ${(svg.length / 1024).toFixed(1)} KB`);
