import { frameHeaders } from '@peera/demo-kit/headers';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@peera/config',
    '@peera/db',
    '@peera/demo-kit',
    '@peera/i18n',
    '@peera/ui',
  ],
  async headers() {
    return [
      ...frameHeaders(
        process.env.ALLOWED_FRAME_ANCESTORS ?? 'http://localhost:3000',
      ),
      // The worker must be re-checked on every visit, so a new version reaches the phone (SPEC §6).
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
