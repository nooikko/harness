import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@harness/ui', '@harness/database', '@harness/plugin-contract'],
};

export default nextConfig;
