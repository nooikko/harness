import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-metrics',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
