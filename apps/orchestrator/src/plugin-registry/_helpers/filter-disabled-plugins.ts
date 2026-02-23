// Filters out disabled plugins based on orchestrator config

import type { Logger } from '@harness/logger';
import type { OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';

type FilterDisabledPlugins = (plugins: PluginDefinition[], config: OrchestratorConfig, logger: Logger) => PluginDefinition[];

export const filterDisabledPlugins: FilterDisabledPlugins = (plugins, config, logger) => {
  const disabled = new Set(config.disabledPlugins);

  if (disabled.size === 0) {
    return plugins;
  }

  const knownNames = new Set(plugins.map((p) => p.name));

  for (const name of disabled) {
    if (!knownNames.has(name)) {
      logger.warn(`Disabled plugin "${name}" not found in registry — ignoring`);
    }
  }

  return plugins.filter((plugin) => {
    if (disabled.has(plugin.name)) {
      logger.info(`Plugin disabled by config: ${plugin.name}`);
      return false;
    }
    return true;
  });
};
