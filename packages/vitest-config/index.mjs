import { defineConfig } from 'vitest/config';

export const nodeConfig = defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
  },
});

export const jsdomConfig = defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
    },
  },
});
