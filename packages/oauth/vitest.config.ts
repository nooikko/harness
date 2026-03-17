import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'oauth',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
