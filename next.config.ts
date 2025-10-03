import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  serverExternalPackages: ['vm2', 'nunjucks', 'chokidar', 'fsevents'],
};

// export default withRspack(nextConfig);

export default withNextIntl(nextConfig);
