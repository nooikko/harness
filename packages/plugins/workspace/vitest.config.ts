import { nodeConfig } from '@harness/vitest-config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      name: 'plugin-workspace',
    },
  }),
);
