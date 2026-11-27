import { saveCertificateSettings } from '@/lib/airtable';
import { failure, pageState, refuse, reply } from '@/lib/certificates-server';
import { SIGNATORY_KEYS, signaturePng, type Signatures } from '@/lib/signatories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The Certificates page: the switch, the signatures, and how many people are waiting. */
export async function GET(req: Request) {
  const no = await refuse(req, false);
  if (no) return no;
  try {
    return reply(await pageState());
  } catch (e) {
    return failure('certificates', e);
  }
}

/**
 * { auto: true | false } turns automatic certificates on or off. { signature: { key, image } } saves an
 * event lead's signature (a PNG data URL, already trimmed by the page) or, with image null, removes it.
 * Emails nobody.
 */
export async function POST(req: Request) {
  const no = await refuse(req);
  if (no) return no;
  const raw = await req.text();
  if (raw.length > 200_000) return reply({ message: 'That picture is too large.' }, 413);
  let body: { auto?: unknown; signature?: { key?: unknown; image?: unknown } };
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ message: 'Invalid request.' }, 400);
  }

  const change: { auto?: boolean; signatures?: Partial<Signatures> } = {};
  if (typeof body.auto === 'boolean') change.auto = body.auto;
  if (body.signature) {
    const key = SIGNATORY_KEYS.find((k) => k === body.signature?.key);
    if (!key) return reply({ message: 'Unknown signatory.' }, 400);
    const image = body.signature.image;
    if (image !== null && (typeof image !== 'string' || !signaturePng(image))) {
      return reply({ message: 'That picture could not be used. Please upload a PNG or JPG of the signature.' }, 400);
    }
    change.signatures = { [key]: image };
  }
  if (change.auto === undefined && !change.signatures) return reply({ message: 'Nothing to change.' }, 400);

  try {
    const settings = await saveCertificateSettings(change);
    console.info('[certificates] settings changed:', JSON.stringify({ auto: change.auto, signatures: change.signatures && Object.fromEntries(Object.entries(change.signatures).map(([k, v]) => [k, v ? 'uploaded' : 'removed'])) }));
    return reply(await pageState(settings));
  } catch (e) {
    return failure('certificates', e);
  }
}
