// Who signs the Certificate of Participation, and where their e-signatures go. Shared by the certificate
// (lib/certificate.ts), the dashboard's Certificates page and its preview.

/** A4 landscape, in points. */
export const CERT_PAGE = { width: 841.89, height: 595.28 } as const;

/**
 * The two event leads, left to right, as printed on assets/certificate/template.pdf. `box` is the space
 * above each name (points from the top-left) that the signature is fitted into, sitting on the name.
 */
export const SIGNATORIES = [
  { key: 'leadA', name: 'Gerwin Kier M. Ebina', title: 'Event Lead - TM241 A', box: { left: 164, top: 440, width: 184, height: 64 } },
  { key: 'leadB', name: 'Veronica Marie B. Consolacion', title: 'Event Lead - TM241 B', box: { left: 494, top: 440, width: 184, height: 64 } },
] as const;
export type SignatoryKey = (typeof SIGNATORIES)[number]['key'];
export const SIGNATORY_KEYS = SIGNATORIES.map((s) => s.key) as SignatoryKey[];

/** A signature as stored: a PNG data URL ("data:image/png;base64,…"), or null when none was uploaded. */
export type Signatures = Record<SignatoryKey, string | null>;
export const NO_SIGNATURES: Signatures = { leadA: null, leadB: null };

/** Airtable long text holds 100,000 characters; a trimmed signature PNG is far smaller. */
export const SIGNATURE_MAX_CHARS = 90_000;
export const SIGNATURE_MAX_PX = 2000;

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

/** The PNG bytes of a stored signature, or null if it isn't a sound PNG of a sensible size. */
export function signaturePng(dataUrl: string | null | undefined): Uint8Array | null {
  if (!dataUrl || dataUrl.length > SIGNATURE_MAX_CHARS) return null;
  const m = dataUrl.match(PNG_DATA_URL);
  if (!m) return null;
  const bin = atob(m[1]);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || SIG.some((b, i) => bytes[i] !== b)) return null;
  const view = new DataView(bytes.buffer);
  const w = view.getUint32(16);
  const h = view.getUint32(20);
  if (!w || !h || w > SIGNATURE_MAX_PX || h > SIGNATURE_MAX_PX) return null;
  return bytes;
}

/** Where a signature of this shape lands inside its box: as large as fits, centred, resting on the name. */
export function placeSignature(box: { left: number; top: number; width: number; height: number }, imgW: number, imgH: number) {
  const scale = Math.min(box.width / imgW, box.height / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return { left: box.left + (box.width - width) / 2, top: box.top + box.height - height, width, height };
}
