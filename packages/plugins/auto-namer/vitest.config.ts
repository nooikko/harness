import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-auto-namer',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
