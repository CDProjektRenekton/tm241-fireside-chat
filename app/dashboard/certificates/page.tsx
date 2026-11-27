import type { Metadata } from 'next';
import CertificatesDesk from '@/components/certificates/CertificatesDesk';
import LoginForm from '@/components/dashboard/LoginForm';
import SpaceBackground from '@/components/SpaceBackground';
import { dashboardConfigured, isAuthenticated } from '@/lib/auth';
import '../dashboard.css';
import '../updates/updates.css';
import './certificates.css';

export const metadata: Metadata = {
  title: 'Certificates · Fireside Chat',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CertificatesPage() {
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
      <CertificatesDesk />
    </>
  );
}
