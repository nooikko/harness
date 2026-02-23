// Plugin registry — static imports of all known plugins, filtered by config

import type { Logger } from '@harness/logger';
import { contextPlugin } from '@harness/plugin-context';
import type { OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { plugin as webPlugin } from '@harness/plugin-web';
import { filterDisabledPlugins } from './_helpers/filter-disabled-plugins';

const ALL_PLUGINS: PluginDefinition[] = [contextPlugin, discordPlugin, webPlugin, delegationPlugin];

type GetPlugins = (config: OrchestratorConfig, logger: Logger) => PluginDefinition[];

export const getPlugins: GetPlugins = (config, logger) => filterDisabledPlugins(ALL_PLUGINS, config, logger);
