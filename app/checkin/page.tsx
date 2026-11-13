import type { Metadata } from 'next';
import CheckInDesk from '@/components/checkin/CheckInDesk';
import LoginForm from '@/components/dashboard/LoginForm';
import SpaceBackground from '@/components/SpaceBackground';
import { dashboardConfigured, sessionRole } from '@/lib/auth';
import '../dashboard/dashboard.css';
import './checkin.css';

export const metadata: Metadata = {
  title: 'Check-in desk · Fireside Chat',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CheckInPage() {
  const role = await sessionRole();
  if (!role) {
    return (
      <>
        <SpaceBackground />
        <main className="login-page">
          <LoginForm configured={dashboardConfigured()} area="checkin" />
        </main>
      </>
    );
  }
  return (
    <>
      {/* a still sky, so the camera and the QR reader get the phone's full attention */}
      <SpaceBackground calm still />
      <CheckInDesk isAdmin={role === 'admin'} />
    </>
  );
}
