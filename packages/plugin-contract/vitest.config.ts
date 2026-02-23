import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-contract",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
