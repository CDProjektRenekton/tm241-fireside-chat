import { NextResponse } from 'next/server';
import { getCertificateSettings } from '@/lib/airtable';
import { buildCertificate } from '@/lib/certificate';
import { failure, refuse } from '@/lib/certificates-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A sample certificate with the signatures as they are now, for organizers to check before sending. */
export async function GET(req: Request) {
  const no = await refuse(req, false);
  if (no) return no;
  try {
    const { signatures } = await getCertificateSettings();
    const pdf = await buildCertificate({ name: 'Juan Dela Cruz', number: 'FC-COP-SAMPLE', signatures });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Sample - Certificate of Participation.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure('certificates/sample', e);
  }
}
