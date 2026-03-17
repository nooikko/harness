import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-calendar',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
