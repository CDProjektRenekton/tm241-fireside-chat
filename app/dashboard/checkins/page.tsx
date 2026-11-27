import type { Metadata } from 'next';
import ArrivalsBoard from '@/components/checkin/ArrivalsBoard';
import LoginForm from '@/components/dashboard/LoginForm';
import SpaceBackground from '@/components/SpaceBackground';
import { dashboardConfigured, isAuthenticated } from '@/lib/auth';
import '../dashboard.css';
import './checkins.css';

export const metadata: Metadata = {
  title: 'Arrivals · Fireside Chat',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckInsPage() {
  if (!(await isAuthenticated())) {
    return (
      <>
        <SpaceBackground />
        <main className="login-page">
          <LoginForm configured={dashboardConfigured()} />
        </main>
      </>
    );
  }
  return (
    <>
      <SpaceBackground calm still />
      <ArrivalsBoard />
    </>
  );
}
