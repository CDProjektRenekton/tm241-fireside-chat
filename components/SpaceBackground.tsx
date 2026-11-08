import GradientCanvas from './GradientCanvas';
import { NEBULA, VIGNETTE } from './nebula';
import Parallax from './Parallax';

/**
 * Fixed galaxy backdrop modelled on the first pubmat: deep navy space, grainy cyan and coral
 * nebula ribbons that drift, rotating halftone arcs in two corners, twinkling stars,
 * four-point sparkles and the occasional shooting star. Purely decorative.
 */

// Small seeded PRNG so the star field is identical on the server and in the browser.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Star {
  l: number;
  t: number;
  s: number;
  tint: '' | 'c' | 'r';
}

function makeStars(count: number, seed: number, maxSize: number): Star[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const roll = r();
    return {
      l: +(r() * 100).toFixed(2),
      t: +(r() * 100).toFixed(2),
      s: +(0.8 + r() * maxSize).toFixed(1),
      tint: roll > 0.86 ? 'c' : roll > 0.78 ? 'r' : '',
    };
  });
}

// Stars are split into groups that twinkle out of step with each other. Animating a few group
// layers is far cheaper than animating every star on its own, and still reads as random twinkling.
const TWINKLE = [
  { d: 3.1, w: 0 },
  { d: 4.3, w: 1.2 },
  { d: 5.2, w: 2.6 },
  { d: 3.7, w: 3.4 },
  { d: 6.1, w: 0.7 },
  { d: 4.8, w: 4.1 },
];

const FAR = makeStars(70, 7, 1.2);
const NEAR = makeStars(28, 41, 2.2);

// Four-point sparkles (left %, top %, size px, delay s).
const SPARKLES = [
  { l: 8, t: 18, s: 18, w: 0 },
  { l: 88, t: 62, s: 26, w: 1.8 },
  { l: 22, t: 78, s: 14, w: 3.2 },
  { l: 64, t: 9, s: 12, w: 2.4 },
  { l: 46, t: 46, s: 10, w: 4.4 },
  { l: 94, t: 30, s: 14, w: 0.9 },
];

function StarLayer({ stars, className }: { stars: Star[]; className: string }) {
  return (
    <div className={`stars ${className}`}>
      {TWINKLE.map((g, gi) => (
        <div key={gi} className="twinkle" style={{ animationDuration: `${g.d}s`, animationDelay: `-${g.w}s` }}>
          {stars
            .filter((_, i) => i % TWINKLE.length === gi)
            .map((s, i) => (
              <span
                key={i}
                className={s.tint ? `tint-${s.tint}` : undefined}
                style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s }}
              />
            ))}
        </div>
      ))}
    </div>
  );
}

export function SparkleShape() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.7 6.6 4 10 12 12-8 2-11.3 5.4-12 12-.7-6.6-4-10-12-12C8 10 11.3 6.6 12 0Z" />
    </svg>
  );
}

/** `calm` dims the sky behind data; `still` also stops its motion (for the camera-heavy check-in desk). */
export default function SpaceBackground({ calm = false, still = false }: { calm?: boolean; still?: boolean }) {
  return (
    <div className={`space${calm ? ' is-calm' : ''}${still ? ' is-paused' : ''}`} aria-hidden="true">
      <Parallax />
      <div className="nebula">
        {NEBULA.map((n) => (
          <GradientCanvas key={n.className} className={n.className} blobs={n.blobs} aspect={n.aspect} width={n.width} />
        ))}
      </div>
      <div className="grain" />
      <div className="par par-far">
        <StarLayer stars={FAR} className="stars-far" />
      </div>
      <div className="par par-near">
        <StarLayer stars={NEAR} className="stars-near" />
        <div className="sparkles">
          {SPARKLES.map((s, i) => (
            <span key={i} style={{ left: `${s.l}%`, top: `${s.t}%`, width: s.s, height: s.s, animationDelay: `${s.w}s` }}>
              <SparkleShape />
            </span>
          ))}
        </div>
      </div>
      <div className="shooting">
        <i />
        <i />
        <i />
      </div>
      <div className="halftone halftone-tr" />
      <div className="halftone halftone-bl" />
      <GradientCanvas className={VIGNETTE.className} blobs={VIGNETTE.blobs} aspect={VIGNETTE.aspect} width={VIGNETTE.width} />
    </div>
  );
}
