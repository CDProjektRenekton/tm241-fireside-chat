import type { Metadata, Viewport } from 'next';
import { ABeeZee, Anton, Pinyon_Script } from 'next/font/google';
import { EVENT, venueFull } from '@/lib/config';
import './globals.css';
import './splash-logo.css';

// Display: tall condensed headline type from the pubmat. Body: ABeeZee (branding kit).
// Accent: a formal script standing in for the branding kit's Sloop Script Pro.
const display = Anton({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-display', display: 'swap' });
const body = ABeeZee({ subsets: ['latin', 'latin-ext'], weight: '400', style: ['normal', 'italic'], variable: '--font-body', display: 'swap' });
const script = Pinyon_Script({ subsets: ['latin'], weight: '400', variable: '--font-script', display: 'swap' });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

const description = `${EVENT.series}: ${EVENT.subtitle}. ${EVENT.weekday}, ${EVENT.dateEn}, ${EVENT.time}, ${venueFull()}.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${EVENT.title} · ${EVENT.series} Registration`,
  description,
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  openGraph: {
    title: `Register: ${EVENT.title} — ${EVENT.series}`,
    description,
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: `${EVENT.series} — ${EVENT.title}` }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.jpg'] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050122',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
