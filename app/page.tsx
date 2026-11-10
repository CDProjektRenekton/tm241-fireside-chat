import Image from 'next/image';
import Countdown from '@/components/Countdown';
import EventLogo from '@/components/EventLogo';
import RegistrationForm from '@/components/form/RegistrationForm';
import { Calendar, Clock, MapPin } from '@/components/Icons';
import SpaceBackground from '@/components/SpaceBackground';
import Splash from '@/components/Splash';
import { EVENT } from '@/lib/config';

export default function Home() {
  return (
    <>
      <SpaceBackground />
      <Splash />
      <main className="page">
        <header className="topbar">
          <div className="logo-bar">
            <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority className="logo" />
            <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority className="logo" />
          </div>
          <p className="topbar-org">
            University of the Philippines Diliman <span aria-hidden="true">·</span> Technology Management Center
          </p>
        </header>

        <div className="stage">
          <section className="hero" aria-labelledby="event-title">
            <p className="hero-kicker">
              <span>{EVENT.series}</span>
            </p>
            <h1 className="hero-title" id="event-title">
              <span className="sr-only">{EVENT.title}</span>
              <EventLogo variant="hero" />
            </h1>
            <p className="hero-sub">{EVENT.subtitle}</p>
            <p className="hero-blurb">{EVENT.blurb}</p>

            <ul className="event-chips" aria-label="Event details">
              <li>
                <Calendar />
                <span>
                  <b>{EVENT.dateShort}</b>
                  <small>{EVENT.weekday}</small>
                </span>
              </li>
              <li>
                <Clock />
                <span>
                  <b>{EVENT.time}</b>
                  <small>Philippine time</small>
                </span>
              </li>
              <li className="chip-venue">
                <MapPin />
                <span>
                  <b>{EVENT.venue}</b>
                  <small>UP Diliman, Quezon City</small>
                </span>
              </li>
            </ul>

            <Countdown />

            <p className="hero-organizer">
              Organized by <b>TM241 Class</b> · UP Diliman Technology Management Center
            </p>
          </section>

          <RegistrationForm />
        </div>

        <footer className="page-foot">
          <p className="foot-tagline">{EVENT.tagline}</p>
          <p>TM241 Class · Technology Management Center · University of the Philippines Diliman</p>
        </footer>
      </main>
    </>
  );
}
