// Creates and manages a lightweight HTTP health check server

import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { Logger } from '@harness/logger';

type HealthStatus = {
  status: 'ok' | 'shutting_down';
  uptime: number;
  timestamp: string;
  version: string;
};

type HealthServerOptions = {
  port: number;
  logger: Logger;
  getStatus: () => HealthStatus;
};

type HealthServer = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

type CreateHealthServer = (options: HealthServerOptions) => HealthServer;

export const createHealthServer: CreateHealthServer = ({ port, logger, getStatus }) => {
  let server: Server | null = null;

  const start = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const httpServer = createServer((req, res) => {
        if (req.url === '/health' && req.method === 'GET') {
          const status = getStatus();
          const statusCode = status.status === 'ok' ? 200 : 503;

          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      });

      httpServer.on('error', (err) => {
        logger.error('Health check server error', {
          error: err.message,
        });
        reject(err);
      });

      httpServer.listen(port, () => {
        logger.info('Health check server listening', { port });
        server = httpServer;
        resolve();
      });
    });
  };

  const stop = async (): Promise<void> => {
    if (!server) {
      return;
    }

    return new Promise((resolve) => {
      server?.close(() => {
        logger.info('Health check server stopped');
        server = null;
        resolve();
      });
    });
  };

  return { start, stop };
};
