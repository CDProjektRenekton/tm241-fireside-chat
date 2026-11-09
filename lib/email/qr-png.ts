import 'server-only';
import { deflateSync } from 'node:zlib';
import { encode } from 'uqr';

// The ticket QR code as a PNG image for emails (mail apps don't show SVG). Same code as the
// boarding pass: error correction "Q", dark navy squares on white, a 4-module quiet zone.

const QUIET = 4;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A 2-colour PNG of the QR code, `scale` pixels per module. */
export function qrPng(text: string, scale = 10) {
  const { size, data } = encode(text, { ecc: 'Q', border: 0 });
  const px = (size + QUIET * 2) * scale;
  const rowBytes = Math.ceil(px / 8);
  const raw = Buffer.alloc((rowBytes + 1) * px); // each row: filter byte 0, then 1 bit per pixel
  for (let y = 0; y < px; y++) {
    const my = Math.floor(y / scale) - QUIET;
    if (my < 0 || my >= size) continue;
    const row = y * (rowBytes + 1) + 1;
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - QUIET;
      if (mx >= 0 && mx < size && data[my][mx]) raw[row + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 3; // indexed colour
  const palette = Buffer.from([0xff, 0xff, 0xff, 0x0a, 0x0b, 0x30]); // 0 = white, 1 = navy #0a0b30
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
