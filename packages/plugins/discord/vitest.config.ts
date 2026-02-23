import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-discord",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
