// Plugin loader — discovers and loads plugins at startup

import type { Logger } from "@harness/logger";
import type { PluginDefinition } from "@/plugin-contract";
import { discoverPlugins, validatePluginExport } from "./_helpers";

export type PluginLoadSuccess = {
  status: "loaded";
  definition: PluginDefinition;
  path: string;
};

export type PluginLoadFailure = {
  status: "failed";
  path: string;
  errors: string[];
};

export type PluginLoadResult = PluginLoadSuccess | PluginLoadFailure;

type LoadAllResult = {
  loaded: PluginDefinition[];
  results: PluginLoadResult[];
};

type PluginLoaderOptions = {
  pluginsDir: string;
  logger: Logger;
};

type CreatePluginLoader = (options: PluginLoaderOptions) => {
  loadAll: () => Promise<LoadAllResult>;
};

export const createPluginLoader: CreatePluginLoader = ({
  pluginsDir,
  logger,
}) => {
  const loadAll = async (): Promise<LoadAllResult> => {
    logger.info("Discovering plugins", { pluginsDir });

    const pluginPaths = await discoverPlugins(pluginsDir);

    if (pluginPaths.length === 0) {
      logger.info("No plugins found");
      return { loaded: [], results: [] };
    }

    logger.info(`Found ${pluginPaths.length} plugin(s) to load`, {
      paths: pluginPaths,
    });

    const results: PluginLoadResult[] = [];
    const loaded: PluginDefinition[] = [];

    for (const pluginPath of pluginPaths) {
      try {
        const moduleExports = (await import(pluginPath)) as Record<
          string,
          unknown
        >;

        const validation = validatePluginExport(moduleExports, pluginPath);

        if (!validation.valid) {
          logger.warn("Plugin validation failed", {
            path: pluginPath,
            errors: validation.errors,
          });
          results.push({
            status: "failed",
            path: pluginPath,
            errors: validation.errors,
          });
          continue;
        }

        loaded.push(validation.definition);
        results.push({
          status: "loaded",
          definition: validation.definition,
          path: pluginPath,
        });
        logger.info(
          `Loaded plugin: ${validation.definition.name}@${validation.definition.version}`,
          { path: pluginPath }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("Failed to import plugin module", {
          path: pluginPath,
          error: errorMessage,
        });
        results.push({
          status: "failed",
          path: pluginPath,
          errors: [`Import error: ${errorMessage}`],
        });
      }
    }

    logger.info(
      `Plugin loading complete: ${loaded.length} loaded, ${results.length - loaded.length} failed`
    );

    return { loaded, results };
  };

  return { loadAll };
};
