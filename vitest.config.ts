import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/web",
      "apps/orchestrator",
      "packages/ui",
      "packages/logger",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/*.config.ts",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/prisma/generated/**",
        "**/.next/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
      ],
    },
  },
});
