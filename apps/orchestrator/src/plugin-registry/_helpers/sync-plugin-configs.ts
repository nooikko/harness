// Synchronizes plugin registry with database PluginConfig records

import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';

type SyncPluginConfigs = (plugins: PluginDefinition[], db: PrismaClient, logger: Logger) => Promise<void>;

export const syncPluginConfigs: SyncPluginConfigs = async (plugins, db, logger) => {
  const pluginNames = plugins.map((p) => p.name);
  const pluginNameSet = new Set(pluginNames);

  const existingConfigs = await db.pluginConfig.findMany();
  const existingNames = new Set(existingConfigs.map((c) => c.pluginName));

  const newPlugins = pluginNames.filter((name) => !existingNames.has(name));

  for (const name of newPlugins) {
    await db.pluginConfig.create({
      data: { pluginName: name, enabled: true },
    });
    logger.info(`Added plugin config for new plugin: ${name}`);
  }

  const staleConfigs = existingConfigs.filter((c) => !pluginNameSet.has(c.pluginName));

  for (const config of staleConfigs) {
    await db.pluginConfig.delete({ where: { id: config.id } });
    logger.info(`Removed stale plugin config: ${config.pluginName}`);
  }
};
