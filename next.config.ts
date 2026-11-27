import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ExcelJS is loaded at runtime from node_modules instead of being bundled.
  serverExternalPackages: ['exceljs', 'nodemailer'],
  // Emails attach their artwork from public/email, and certificates are made from assets/certificate, so ship those
  // files with the functions that use them.
  outputFileTracingIncludes: {
    '/api/submit': ['./public/email/**/*'],
    '/api/email/**/*': ['./public/email/**/*'],
    '/api/feedback': ['./public/email/**/*', './assets/certificate/**/*'],
    '/api/feedback/**/*': ['./public/email/**/*', './assets/certificate/**/*'],
    '/api/certificates': ['./public/email/**/*', './assets/certificate/**/*'],
    '/api/certificates/**/*': ['./public/email/**/*', './assets/certificate/**/*'],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // The check-in desk scans tickets with the camera; every other page keeps it blocked.
      { source: '/checkin', headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' }] },
    ];
  },
};

export default nextConfig;
