import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-outlook-calendar',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
