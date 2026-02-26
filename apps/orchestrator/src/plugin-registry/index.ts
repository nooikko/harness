// Plugin registry — static imports of all known plugins, filtered by database config

import type { Logger } from '@harness/logger';
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { plugin as contextPlugin } from '@harness/plugin-context';
import type { PluginDefinition } from '@harness/plugin-contract';
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { plugin as timePlugin } from '@harness/plugin-time';
import { plugin as webPlugin } from '@harness/plugin-web';
import type { PrismaClient } from 'database';
import { filterDisabledPlugins } from './_helpers/filter-disabled-plugins';
import { syncPluginConfigs } from './_helpers/sync-plugin-configs';

const ALL_PLUGINS: PluginDefinition[] = [activityPlugin, contextPlugin, discordPlugin, webPlugin, delegationPlugin, metricsPlugin, timePlugin];

type GetPlugins = (db: PrismaClient, logger: Logger) => Promise<PluginDefinition[]>;

export const getPlugins: GetPlugins = async (db, logger) => {
  await syncPluginConfigs(ALL_PLUGINS, db, logger);
  return filterDisabledPlugins(ALL_PLUGINS, db, logger);
};
