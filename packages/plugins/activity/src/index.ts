import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';

// All existing plugins use `export const plugin` inline — match this pattern
export const plugin: PluginDefinition = {
  name: 'activity',
  version: '1.0.0',
  register: async (_ctx: PluginContext): Promise<PluginHooks> => ({}),
};
