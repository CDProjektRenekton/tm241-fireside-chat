'use client';

import { useEffect, useRef } from 'react';

/** One elliptical radial gradient: centre and radii as fractions of the box, colours as "r,g,b,a". */
export interface GradientBlob {
  at: [number, number];
  r: [number, number];
  stops: [number, string][];
}

/**
 * Soft gradient clouds drawn once into a small canvas that CSS stretches to size.
 *
 * Performance: a CSS gradient on a large animated element is rasterized at full device
 * resolution (9× the pixels on a 3× phone screen) and re-rasterized as it moves. A canvas is a
 * fixed-size texture the GPU simply scales — and smooth gradients look identical either way.
 */
export default function GradientCanvas({
  className,
  blobs,
  width = 256,
  aspect,
}: {
  className: string;
  blobs: readonly GradientBlob[];
  width?: number;
  /** height / width of the element as styled in CSS */
  aspect: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.max(8, Math.round(width * aspect));

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // CSS paints the first gradient on top, so draw in reverse.
    for (const b of [...blobs].reverse()) {
      ctx.save();
      ctx.translate(b.at[0] * W, b.at[1] * H);
      ctx.scale(b.r[0] * W, b.r[1] * H);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [offset, rgba] of b.stops) g.addColorStop(offset, `rgba(${rgba})`);
      ctx.fillStyle = g;
      ctx.fillRect(-b.at[0] / b.r[0], -b.at[1] / b.r[1], 1 / b.r[0], 1 / b.r[1]);
      ctx.restore();
    }
    canvas.dataset.ready = '';
  }, [blobs]);

  return <canvas ref={ref} className={className} width={width} height={height} aria-hidden="true" />;
}
