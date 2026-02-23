import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "orchestrator",
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
