import { encode } from 'uqr';

const QUIET = 4; // modules of white margin the QR standard asks for, so any scanner can find the code

/**
 * The scannable QR code on the boarding pass. Plain dark-on-white squares (no styling tricks),
 * so phone cameras, laptop webcams and printouts all read it. Error correction "Q" keeps it
 * readable with up to a quarter of it smudged, folded or hidden behind glare.
 */
export default function TicketQR({ value, className }: { value: string; className?: string }) {
  const { size, data } = encode(value, { ecc: 'Q', border: 0 });
  // One path for every dark module, with horizontal runs merged into single rectangles.
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y][x]) continue;
      let run = 1;
      while (x + run < size && data[y][x + run]) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  const box = size + QUIET * 2;
  return (
    <svg
      className={className}
      viewBox={`${-QUIET} ${-QUIET} ${box} ${box}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for reference number ${value}`}
    >
      <rect x={-QUIET} y={-QUIET} width={box} height={box} rx={2.5} fill="#fff" />
      <path d={d} fill="#0a0b30" />
    </svg>
  );
}
