import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-delegation",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
