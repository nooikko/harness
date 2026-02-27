import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['ui', 'database', '@harness/plugin-contract'],
};

export default nextConfig;
