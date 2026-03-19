import { resolve } from 'node:path';
import { jsdomConfig } from '@harness/vitest-config';
import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  jsdomConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@/': `${resolve(__dirname, 'src')}/`,
        '@harness/ui': resolve(__dirname, '../../packages/ui/src'),
        '@harness/database': resolve(__dirname, '../../packages/database/src'),
        'server-only': resolve(__dirname, 'src/__stubs__/server-only.ts'),
      },
    },
    test: {
      name: 'dashboard',
      setupFiles: ['./vitest.setup.ts'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }),
);
