// Health check module — exposes a lightweight HTTP server for production monitoring

import type { Logger } from '@harness/logger';
import { createHealthServer } from './_helpers/create-health-server';

type HealthCheckOptions = {
  port: number;
  logger: Logger;
  version: string;
};

type HealthCheckModule = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setShuttingDown: () => void;
};

type CreateHealthCheck = (options: HealthCheckOptions) => HealthCheckModule;

export const createHealthCheck: CreateHealthCheck = ({ port, logger, version }) => {
  const startTime = Date.now();
  let shuttingDown = false;

  const getStatus = () => ({
    status: shuttingDown ? ('shutting_down' as const) : ('ok' as const),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version,
  });

  const server = createHealthServer({
    port,
    logger,
    getStatus,
  });

  const setShuttingDown = (): void => {
    shuttingDown = true;
  };

  return {
    start: server.start,
    stop: server.stop,
    setShuttingDown,
  };
};
