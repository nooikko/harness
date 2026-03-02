import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'plugin-summarization',
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});
