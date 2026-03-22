// Bootstrap and lifecycle manager — orchestrator entry point

import { prisma } from '@harness/database';
import { createLogger, flushLogger, writeErrorToDb } from '@harness/logger';
import { validateEncryptionKeyIfSet } from '@harness/oauth';
import type { PluginDefinition } from '@harness/plugin-contract';
import { state as delegationState } from '@harness/plugin-delegation';
import { checkUploadDir } from './_helpers/check-upload-dir';
import { recoverOrphanedTasks } from './_helpers/recover-orphaned-tasks';
import { loadConfig } from './config';
import { createHealthCheck } from './health-check';
import { createSdkInvoker } from './invoker-sdk';
import type { PluginHealth } from './orchestrator';
import { createOrchestrator } from './orchestrator';
import { createPluginLoader } from './plugin-loader';
import { getAllPluginNames, getPlugins } from './plugin-registry';
import { collectTools, createToolServer } from './tool-server';

type ShutdownState = {
  isShuttingDown: boolean;
};

type BootResult = {
  shutdown: () => Promise<void>;
};

type Boot = () => Promise<BootResult>;

export const boot: Boot = async () => {
  const logger = createLogger('harness');

  logger.info('Loading configuration');
  const config = loadConfig();

  // Catch malformed OAUTH_ENCRYPTION_KEY early (only if set — OAuth is optional)
  validateEncryptionKeyIfSet();

  await checkUploadDir(config.uploadDir, logger);

  logger.info('Initializing database connection');
  await prisma.$connect();

  logger.info('Scanning for orphaned tasks from previous run');
  const recovered = await recoverOrphanedTasks(prisma, logger);
  if (recovered > 0) {
    logger.warn(`Recovered ${recovered} orphaned task(s) — they have been marked failed`);
  }

  logger.info('Loading plugins from registry');
  const rawPlugins = await getPlugins(prisma, logger);

  logger.info('Validating plugins');
  const loader = createPluginLoader({
    plugins: rawPlugins,
    logger,
  });
  const { loaded } = loader.loadAll();

  logger.info('Collecting plugin tools');
  const allTools = collectTools(loaded);

  // Check if any tools exist (determines whether to configure MCP servers)
  const hasTools = allTools.length > 0;
  if (hasTools) {
    logger.info('Tool server configured', { toolCount: allTools.length });
  }

  logger.info('Creating SDK invoker', {
    model: config.claudeModel,
    timeout: config.claudeTimeout,
  });
  const invoker = createSdkInvoker({
    defaultModel: config.claudeModel,
    defaultTimeout: config.claudeTimeout,
    // Per-session tool server: each session gets its own contextRef, passed to createToolServer
    // so tool handlers capture a session-local ref instead of a global one. drainQueue in
    // create-session.ts updates this ref when a request becomes active.
    ...(hasTools ? { sessionConfig: { mcpServerFactory: (ref) => ({ harness: createToolServer(allTools, ref)! }) } } : {}),
  });

  logger.info('Creating orchestrator');
  const orchestrator = createOrchestrator({
    db: prisma,
    invoker,
    config,
    logger,
    toolNames: allTools.map((t) => t.qualifiedName),
  });

  // Late-bind PluginContext to the invoker so per-invocation meta includes ctx
  invoker.setPluginContext(orchestrator.getContext());

  logger.info('Registering plugins');
  for (const plugin of loaded) {
    try {
      await orchestrator.registerPlugin(plugin);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to register plugin', {
        plugin: plugin.name,
        error: errorMsg,
      });
      writeErrorToDb({
        db: prisma,
        level: 'error',
        source: plugin.name,
        message: `Plugin registration failed: ${errorMsg}`,
        stack: err instanceof Error ? err.stack : undefined,
      });
    }
  }

  // Wire delegation plugin's hook resolver so onTaskCreate/onTaskComplete/onTaskFailed
  // fire during tool-path delegation. state.currentHooks is null until this runs,
  // so any plugin implementing those hooks (e.g. validator) would be silently skipped.
  if (delegationState.setHooks) {
    delegationState.setHooks(orchestrator.getHooks());
    logger.info('Wired delegation hook resolver', { hookCount: orchestrator.getHooks().length });
  }

  logger.info('Starting plugins');
  await orchestrator.start();

  // Compute disabled plugins (in registry but not loaded)
  const loadedNames = new Set(loaded.map((p: PluginDefinition) => p.name));
  const disabledHealth: PluginHealth[] = getAllPluginNames()
    .filter((name) => !loadedNames.has(name))
    .map((name) => ({ name, status: 'disabled' as const }));

  const healthPort = Number(process.env.HEALTH_PORT ?? '4002');
  const healthCheck = createHealthCheck({
    port: healthPort,
    logger,
    version: process.env.npm_package_version ?? '0.1.0',
    getPluginHealth: () => [...orchestrator.getPluginHealth(), ...disabledHealth],
  });

  logger.info('Starting health check server', { port: healthPort });
  await healthCheck.start();

  const state: ShutdownState = { isShuttingDown: false };

  const shutdown = async (): Promise<void> => {
    if (state.isShuttingDown) {
      return;
    }
    state.isShuttingDown = true;

    logger.info('Graceful shutdown initiated');
    healthCheck.setShuttingDown();

    try {
      logger.info('Stopping health check server');
      await healthCheck.stop();
    } catch (err) {
      logger.error('Error stopping health check server', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      logger.info('Stopping plugins');
      await orchestrator.stop();
    } catch (err) {
      logger.error('Error stopping plugins', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      logger.info('Closing warm sessions');
      invoker.stop();
    } catch (err) {
      logger.error('Error closing warm sessions', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      logger.info('Disconnecting database');
      await prisma.$disconnect();
    } catch (err) {
      logger.error('Error disconnecting database', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    flushLogger();
    logger.info('Shutdown complete');
  };

  const onSignal = (): void => {
    if (state.isShuttingDown) {
      return;
    }
    shutdown()
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error('Fatal error during shutdown', {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      });
  };

  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  const pluginNames = loaded.map((p: PluginDefinition) => p.name);
  logger.info('Orchestrator ready', {
    plugins: pluginNames,
    port: config.port,
  });

  return { shutdown };
};

export const main = async (): Promise<void> => {
  const logger = createLogger('harness');
  let shutdownFn: (() => Promise<void>) | null = null;

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
    writeErrorToDb({
      db: prisma,
      level: 'error',
      source: 'process',
      message: `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught exception — initiating shutdown', {
      error: err.message,
      stack: err.stack,
    });
    // Best-effort: this fire-and-forget write races against process.exit below.
    // The DB row may not land if shutdown + exit completes first.
    writeErrorToDb({
      db: prisma,
      level: 'error',
      source: 'process',
      message: `Uncaught exception: ${err.message}`,
      stack: err.stack,
    });
    const doShutdown = shutdownFn ?? (() => Promise.resolve());
    doShutdown()
      .catch(() => {})
      .finally(() => process.exit(1));
  });

  try {
    const result = await boot();
    shutdownFn = result.shutdown;
  } catch (err) {
    logger.error('Fatal error during boot', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
};

/* v8 ignore next 3 -- entry-point guard, only runs in production */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main();
}

export type { HandleMessageResult, OrchestratorDeps, PluginHealth } from './orchestrator';
export { createOrchestrator } from './orchestrator';
