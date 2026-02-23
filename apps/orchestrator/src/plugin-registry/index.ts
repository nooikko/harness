// Plugin registry — static imports of all known plugins

import { contextPlugin } from '@harness/plugin-context';
import type { PluginDefinition } from '@harness/plugin-contract';
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { plugin as webPlugin } from '@harness/plugin-web';

type GetPlugins = () => PluginDefinition[];

export const getPlugins: GetPlugins = () => [contextPlugin, discordPlugin, webPlugin, delegationPlugin];
