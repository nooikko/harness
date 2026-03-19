import { jsdomConfig } from '@harness/vitest-config';
import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  jsdomConfig,
  defineConfig({
    plugins: [react()],
    test: {
      name: 'ui',
      setupFiles: ['./vitest.setup.ts'],
    },
  }),
);
