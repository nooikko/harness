import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` is a Next.js compile-time guard that has no browser/node
      // equivalent. Alias it to an empty stub so tests can import files that
      // use it without crashing.
      'server-only': '/Users/quinn/dev/harness/apps/web/src/__stubs__/server-only.ts',
    },
  },
  test: {
    name: 'dashboard',
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
