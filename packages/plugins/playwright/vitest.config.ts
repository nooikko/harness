import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-playwright',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
