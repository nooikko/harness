// Plugin registry — static imports of all known plugins, filtered by database config

import type { Logger } from '@harness/logger';
import { contextPlugin } from '@harness/plugin-context';
import type { PluginDefinition } from '@harness/plugin-contract';
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { plugin as webPlugin } from '@harness/plugin-web';
import type { PrismaClient } from 'database';
import { filterDisabledPlugins } from './_helpers/filter-disabled-plugins';
import { syncPluginConfigs } from './_helpers/sync-plugin-configs';

const ALL_PLUGINS: PluginDefinition[] = [contextPlugin, discordPlugin, webPlugin, delegationPlugin];

type GetPlugins = (db: PrismaClient, logger: Logger) => Promise<PluginDefinition[]>;

export const getPlugins: GetPlugins = async (db, logger) => {
  await syncPluginConfigs(ALL_PLUGINS, db, logger);
  return filterDisabledPlugins(ALL_PLUGINS, db, logger);
};
