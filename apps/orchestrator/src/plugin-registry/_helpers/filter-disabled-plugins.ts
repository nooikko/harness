// Filters out disabled plugins based on database PluginConfig records

import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';

type FilterDisabledPlugins = (plugins: PluginDefinition[], db: PrismaClient, logger: Logger) => Promise<PluginDefinition[]>;

export const filterDisabledPlugins: FilterDisabledPlugins = async (plugins, db, logger) => {
  const disabledRecords = await db.pluginConfig.findMany({
    where: { enabled: false },
  });

  if (disabledRecords.length === 0) {
    return plugins;
  }

  const knownNames = new Set(plugins.map((p) => p.name));
  const disabled = new Set(disabledRecords.map((r) => r.pluginName));

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
