import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "plugin-web",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
