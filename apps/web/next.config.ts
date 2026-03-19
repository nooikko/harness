import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@harness/ui', '@harness/database', '@harness/plugin-contract', '@harness/oauth', '@harness/logger'],
};

export default nextConfig;
