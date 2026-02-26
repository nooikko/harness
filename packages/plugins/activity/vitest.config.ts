import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-activity',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
