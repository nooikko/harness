import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-validator',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
