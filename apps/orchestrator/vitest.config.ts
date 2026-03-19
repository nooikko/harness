import { resolve } from 'node:path';
import { nodeConfig } from '@harness/vitest-config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    resolve: {
      alias: {
        '@/': `${resolve(__dirname, 'src')}/`,
      },
    },
    test: {
      name: 'orchestrator',
      exclude: ['**/dist/**', '**/node_modules/**'],
    },
  }),
);
