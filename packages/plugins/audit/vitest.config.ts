import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-audit',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
