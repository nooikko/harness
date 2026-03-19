import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/': `${resolve(__dirname, 'src')}/`,
    },
  },
  test: {
    name: 'integration',
    environment: 'node',
    globalSetup: './setup/global-setup.ts',
    testTimeout: 90_000,
    hookTimeout: 90_000,
    fileParallelism: false,
  },
});
