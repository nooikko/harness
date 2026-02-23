import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/web',
      'apps/orchestrator',
      'packages/ui',
      'packages/logger',
      'packages/plugin-contract',
      'packages/plugins/context',
      'packages/plugins/discord',
      'packages/plugins/web',
      'packages/plugins/delegation',
      'packages/database',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        '**/*.config.ts',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/prisma/generated/**',
        '**/.next/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    },
  },
});
