// Bootstrap and lifecycle manager — orchestrator entry point

import { createLogger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import { prisma } from 'database';
import { loadConfig } from './config';
import { createHealthCheck } from './health-check';
import { createSdkInvoker } from './invoker-sdk';
import { createOrchestrator } from './orchestrator';
import { createPluginLoader } from './plugin-loader';
import { getPlugins } from './plugin-registry';

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

  logger.info('Initializing database connection');
  await prisma.$connect();

  logger.info('Creating SDK invoker', {
    model: config.claudeModel,
    timeout: config.claudeTimeout,
  });
  const invoker = createSdkInvoker({
    defaultModel: config.claudeModel,
    defaultTimeout: config.claudeTimeout,
  });

  logger.info('Loading plugins from registry');
  const rawPlugins = await getPlugins(prisma, logger);

  logger.info('Validating plugins');
  const loader = createPluginLoader({
    plugins: rawPlugins,
    logger,
  });
  const { loaded } = loader.loadAll();

  logger.info('Creating orchestrator');
  const orchestrator = createOrchestrator({
    db: prisma,
    invoker,
    config,
    logger,
  });

  logger.info('Registering plugins');
  for (const plugin of loaded) {
    await orchestrator.registerPlugin(plugin);
  }

  logger.info('Starting plugins');
  await orchestrator.start();

  const healthPort = Number(process.env.HEALTH_PORT ?? '4002');
  const healthCheck = createHealthCheck({
    port: healthPort,
    logger,
    version: process.env.npm_package_version ?? '0.1.0',
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

    logger.info('Shutdown complete');
  };

  const onSignal = (): void => {
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
  try {
    await boot();
  } catch (err) {
    const logger = createLogger('harness');
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
