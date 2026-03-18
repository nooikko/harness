import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-storytelling',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
