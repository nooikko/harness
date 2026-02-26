import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-time',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
