'use client';

import { useEffect } from 'react';

/**
 * Drifts the star layers with the cursor. Transforms are written straight onto the two layers
 * and eased in a short requestAnimationFrame loop that stops once they settle, so moving the
 * mouse never triggers a page-wide style recalculation.
 */
export default function Parallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const far = document.querySelector<HTMLElement>('.par-far');
    const near = document.querySelector<HTMLElement>('.par-near');
    if (!far || !near) return;

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let frame = 0;

    const step = () => {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      far.style.transform = `translate3d(${(-x * 8).toFixed(2)}px, ${(-y * 8).toFixed(2)}px, 0)`;
      near.style.transform = `translate3d(${(-x * 22).toFixed(2)}px, ${(-y * 22).toFixed(2)}px, 0)`;
      frame = Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002 ? window.requestAnimationFrame(step) : 0;
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = window.requestAnimationFrame(step);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
