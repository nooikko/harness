// Plugin registry — static imports of all known plugins, filtered by database config

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { plugin as auditPlugin } from '@harness/plugin-audit';
import { plugin as autoNamerPlugin } from '@harness/plugin-auto-namer';
import { plugin as calendarPlugin } from '@harness/plugin-calendar';
import { plugin as contextPlugin } from '@harness/plugin-context';
import type { PluginDefinition } from '@harness/plugin-contract';
import { plugin as cronPlugin } from '@harness/plugin-cron';
import { plugin as delegationPlugin } from '@harness/plugin-delegation';
import { plugin as discordPlugin } from '@harness/plugin-discord';
import { plugin as identityPlugin } from '@harness/plugin-identity';
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { musicPlugin } from '@harness/plugin-music';
import { plugin as outlookPlugin } from '@harness/plugin-outlook';
import { plugin as outlookCalendarPlugin } from '@harness/plugin-outlook-calendar';
import { plugin as playwrightPlugin } from '@harness/plugin-playwright';
import { projectPlugin } from '@harness/plugin-project';
import { plugin as searchPlugin } from '@harness/plugin-search';
import { plugin as summarizationPlugin } from '@harness/plugin-summarization';
import { tasksPlugin } from '@harness/plugin-tasks';
import { plugin as timePlugin } from '@harness/plugin-time';
import { plugin as validatorPlugin } from '@harness/plugin-validator';
import { plugin as webPlugin } from '@harness/plugin-web';
import { filterDisabledPlugins } from './_helpers/filter-disabled-plugins';
import { syncPluginConfigs } from './_helpers/sync-plugin-configs';

const ALL_PLUGINS: PluginDefinition[] = [
  identityPlugin,
  activityPlugin,
  contextPlugin,
  discordPlugin,
  webPlugin,
  cronPlugin,
  delegationPlugin,
  validatorPlugin,
  metricsPlugin,
  summarizationPlugin,
  autoNamerPlugin,
  auditPlugin,
  timePlugin,
  projectPlugin,
  tasksPlugin,
  outlookPlugin,
  outlookCalendarPlugin,
  calendarPlugin,
  musicPlugin,
  searchPlugin,
  playwrightPlugin,
];

type GetPlugins = (db: PrismaClient, logger: Logger) => Promise<PluginDefinition[]>;

export const getPlugins: GetPlugins = async (db, logger) => {
  await syncPluginConfigs(ALL_PLUGINS, db, logger);
  return filterDisabledPlugins(ALL_PLUGINS, db, logger);
};

export const getAllPluginNames = (): string[] => ALL_PLUGINS.map((p) => p.name);
