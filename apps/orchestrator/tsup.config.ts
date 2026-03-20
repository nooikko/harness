import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Mark workspace packages and node_modules as external —
  // they're resolved at runtime from node_modules, not bundled in
  external: [/^@harness\//, /^@anthropic-ai\//, /^@prisma\//, 'zod'],
});
