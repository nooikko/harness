import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-outlook',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
