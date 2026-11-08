import type { GradientBlob } from './GradientCanvas';

// The cyan / coral nebula from the first pubmat, as elliptical radial gradients.
// Each entry mirrors a CSS `radial-gradient(rx ry at x y, …)`: centre and radii are fractions of
// the element's box (sizes live in globals.css). `aspect` = the element's height / width.

const CYAN = '138,209,226';
const AQUA = '94,182,211';
const STEEL = '72,150,190';
const DEEP = '42,91,138';
const NAVY = '30,66,113';
const BLUE = '59,125,167';
const CORAL = '232,71,90';

const fade = (rgb: string, a0: number, mid: number, a1: number): [number, string][] => [
  [0, `${rgb},${a0}`],
  [mid, `${rgb},${a1}`],
  [1, `${rgb},0`],
];

export interface NebulaSpec {
  className: string;
  aspect: number;
  width?: number;
  blobs: GradientBlob[];
}

/** Page backdrop (components/SpaceBackground.tsx). */
export const NEBULA: NebulaSpec[] = [
  {
    // the cyan "fabric" swoosh that crosses the pubmat — 150vmax × 40vmax
    className: 'neb neb-cyan',
    aspect: 40 / 150,
    width: 320,
    blobs: [
      { at: [0.33, 0.5], r: [0.4, 0.5], stops: fade(CYAN, 0.8, 0.45, 0.36) },
      { at: [0.52, 0.5], r: [0.34, 0.46], stops: fade(AQUA, 0.58, 0.5, 0.22) },
      { at: [0.71, 0.5], r: [0.32, 0.42], stops: fade(DEEP, 0.46, 0.5, 0.16) },
    ],
  },
  {
    // the darker blue fold above the swoosh — 120vmax × 26vmax
    className: 'neb neb-fold',
    aspect: 26 / 120,
    width: 320,
    blobs: [
      { at: [0.4, 0.5], r: [0.38, 0.5], stops: fade(NAVY, 0.78, 0.5, 0.32) },
      { at: [0.62, 0.5], r: [0.28, 0.44], stops: fade(BLUE, 0.46, 0.5, 0.16) },
    ],
  },
  {
    // cyan glow, top left — 66vmax square
    className: 'neb neb-glow',
    aspect: 1,
    blobs: [
      {
        at: [0.5, 0.5],
        r: [0.5, 0.5],
        stops: [
          [0, `${AQUA},0.5`],
          [0.35, `${STEEL},0.32`],
          [0.62, `${DEEP},0.14`],
          [1, `${DEEP},0`],
        ],
      },
    ],
  },
  {
    // coral, bottom right — 62vmax × 50vmax
    className: 'neb neb-coral',
    aspect: 50 / 62,
    blobs: [
      {
        at: [0.5, 0.5],
        r: [0.5, 0.5],
        stops: [
          [0, `${CORAL},0.72`],
          [0.38, `${CORAL},0.42`],
          [0.7, `${CORAL},0.14`],
          [1, `${CORAL},0`],
        ],
      },
    ],
  },
  {
    // coral, left edge — 34vmax × 26vmax
    className: 'neb neb-coral-2',
    aspect: 26 / 34,
    width: 160,
    blobs: [{ at: [0.5, 0.5], r: [0.5, 0.5], stops: fade(CORAL, 0.5, 0.55, 0.2) }],
  },
];

/** Darkened edges over the whole backdrop — CSS was radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(3,0,32,.7)). */
export const VIGNETTE: NebulaSpec = {
  className: 'vignette',
  aspect: 10 / 16,
  width: 160,
  blobs: [
    {
      at: [0.5, 0.4],
      r: [1.3, 1],
      stops: [
        [0, '3,0,32,0'],
        [0.55, '3,0,32,0'],
        [1, '3,0,32,0.7'],
      ],
    },
  ],
};

/** Splash backdrop (components/Splash.tsx). */
export const SPLASH_NEBULA: NebulaSpec[] = [
  {
    // 76vmax × 32vmax
    className: 'splash-neb splash-neb-1',
    aspect: 32 / 76,
    blobs: [
      { at: [0.4, 0.5], r: [0.4, 0.5], stops: fade(CYAN, 0.62, 0.48, 0.26) },
      { at: [0.7, 0.5], r: [0.3, 0.44], stops: fade(DEEP, 0.44, 0.5, 0.14) },
    ],
  },
  {
    // 52vmax × 46vmax
    className: 'splash-neb splash-neb-2',
    aspect: 46 / 52,
    blobs: [{ at: [0.5, 0.5], r: [0.5, 0.5], stops: fade(CORAL, 0.6, 0.5, 0.26) }],
  },
  {
    // 56vmax square
    className: 'splash-neb splash-neb-3',
    aspect: 1,
    blobs: [{ at: [0.5, 0.5], r: [0.5, 0.5], stops: fade(AQUA, 0.45, 0.5, 0.18) }],
  },
];
