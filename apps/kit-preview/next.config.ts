import { frameHeaders } from '@peera/demo-kit/headers';
import type { NextConfig } from 'next';

// Dev-only gallery of the shared packages; never deployed. The e2e host page frames it from 127.0.0.1 (random port).
const nextConfig: NextConfig = {
  transpilePackages: [
    '@peera/ui',
    '@peera/i18n',
    '@peera/demo-kit',
    '@peera/db',
  ],
  async headers() {
    return frameHeaders(
      process.env.ALLOWED_FRAME_ANCESTORS ??
        'http://127.0.0.1:* http://localhost:3000',
    );
  },
};

export default nextConfig;
