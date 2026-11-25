import type { Metadata } from 'next';
import Image from 'next/image';
import EventLogo from '@/components/EventLogo';
import FeedbackForm from '@/components/feedback/FeedbackForm';
import { Clock } from '@/components/Icons';
import SpaceBackground from '@/components/SpaceBackground';
import { EVENT } from '@/lib/config';
import { FEEDBACK_OPENS_AT } from '@/lib/feedback';
import { access } from '@/lib/feedback-server';
import './feedback.css';

export const metadata: Metadata = {
  title: `Feedback · ${EVENT.series}: ${EVENT.title}`,
  description: `Tell us about the ${EVENT.series} and get your Certificate of Participation.`,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const opens = new Date(FEEDBACK_OPENS_AT);
const opensDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' }).format(opens);
const opensTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }).format(opens);

/** Feedback after the event; finishing it gives the Certificate of Participation. */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const mode = await access();
  const { ref } = await searchParams;
  return (
    <>
      <SpaceBackground still />
      <main className="page feedback-page">
        <header className="topbar">
          <div className="logo-bar">
            <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority className="logo" />
            <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority className="logo" />
          </div>
          <p className="topbar-org">
            <span>University of the Philippines Diliman</span>
            <span>Technology Management Center</span>
          </p>
        </header>

        <section className="feedback-hero" aria-labelledby="feedback-title">
          <p className="hero-kicker">
            <span>{EVENT.series}</span>
          </p>
          <div className="feedback-logo">
            <span className="sr-only">{EVENT.title}</span>
            <EventLogo variant="pass" />
          </div>
          <h1 id="feedback-title">Feedback form</h1>
          <p>Tell us how it went. It takes about three minutes, and your Certificate of Participation is ready as soon as you finish.</p>
        </section>

        {mode === 'closed' ? (
          <section className="form-card feedback-closed">
            <Clock width={30} height={30} />
            <h2>Not open yet</h2>
            <p>
              The feedback form opens on <b>{opensDay}</b> at <b>{opensTime}</b> (Philippine time), when the {EVENT.series} starts.
            </p>
          </section>
        ) : (
          <FeedbackForm preview={mode === 'preview'} opens={`${opensDay}, ${opensTime}`} initialWho={typeof ref === 'string' ? ref.slice(0, 40) : ''} />
        )}

        <footer className="page-foot">
          <p className="foot-tagline">{EVENT.tagline}</p>
          <p>Technology Management Center · University of the Philippines Diliman</p>
        </footer>
      </main>
    </>
  );
}
