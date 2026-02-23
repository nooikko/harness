// Plugin loader — validates and loads plugins from a static registry

import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import { validatePluginExport } from './_helpers/validate-plugin';

export type PluginLoadSuccess = {
  status: 'loaded';
  definition: PluginDefinition;
};

export type PluginLoadFailure = {
  status: 'failed';
  name: string;
  errors: string[];
};

export type PluginLoadResult = PluginLoadSuccess | PluginLoadFailure;

type LoadAllResult = {
  loaded: PluginDefinition[];
  results: PluginLoadResult[];
};

type PluginLoaderOptions = {
  plugins: PluginDefinition[];
  logger: Logger;
};

type CreatePluginLoader = (options: PluginLoaderOptions) => {
  loadAll: () => LoadAllResult;
};

export const createPluginLoader: CreatePluginLoader = ({ plugins, logger }) => {
  const loadAll = (): LoadAllResult => {
    logger.info(`Validating ${plugins.length} plugin(s)`);

    if (plugins.length === 0) {
      logger.info('No plugins to load');
      return { loaded: [], results: [] };
    }

    const results: PluginLoadResult[] = [];
    const loaded: PluginDefinition[] = [];

    for (const plugin of plugins) {
      const moduleExports = { plugin } as Record<string, unknown>;
      const validation = validatePluginExport(moduleExports, plugin.name ?? 'unknown');

      if (!validation.valid) {
        logger.warn('Plugin validation failed', {
          name: plugin.name,
          errors: validation.errors,
        });
        results.push({
          status: 'failed',
          name: plugin.name ?? 'unknown',
          errors: validation.errors,
        });
        continue;
      }

      loaded.push(validation.definition);
      results.push({
        status: 'loaded',
        definition: validation.definition,
      });
      logger.info(`Loaded plugin: ${validation.definition.name}@${validation.definition.version}`);
    }

    logger.info(`Plugin loading complete: ${loaded.length} loaded, ${results.length - loaded.length} failed`);

    return { loaded, results };
  };

  return { loadAll };
};
