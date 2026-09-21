import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.COMMON_E2E === '1' ? '.next-e2e' : '.next',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};
export default config;
