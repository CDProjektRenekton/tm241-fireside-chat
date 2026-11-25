import type { Metadata } from 'next';
import LoginForm from '@/components/dashboard/LoginForm';
import SpaceBackground from '@/components/SpaceBackground';
import UpdatesDesk from '@/components/updates/UpdatesDesk';
import { dashboardConfigured, isAuthenticated } from '@/lib/auth';
import '../dashboard.css';
import './updates.css';

export const metadata: Metadata = {
  title: 'Email updates · Fireside Chat',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function UpdatesPage() {
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
      <SpaceBackground calm />
      <UpdatesDesk />
    </>
  );
}
