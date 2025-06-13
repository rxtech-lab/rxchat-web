import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
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

export default nextConfig;
