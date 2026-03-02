// WebSocket broadcaster — manages connected clients and emits events

import type { Server as HttpServer } from 'node:http';
import type { Logger } from '@harness/logger';
import { type WebSocket, WebSocketServer } from 'ws';

export type WsBroadcasterDeps = {
  server: HttpServer;
  logger: Logger;
};

export type WsBroadcaster = {
  broadcast: (event: string, data: unknown) => void;
  getClientCount: () => number;
  close: () => Promise<void>;
};

type CreateWsBroadcaster = (deps: WsBroadcasterDeps) => WsBroadcaster;

export const createWsBroadcaster: CreateWsBroadcaster = ({ server, logger }) => {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info('WebSocket client connected', { total: clients.size });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', { total: clients.size });
    });

    ws.on('error', (err: Error) => {
      logger.error('WebSocket client error', { error: err.message });
      clients.delete(ws);
    });
  });

  return {
    broadcast: (event, data) => {
      let payload: string;
      try {
        payload = JSON.stringify({ event, data, timestamp: Date.now() });
      } catch (err) {
        logger.error(`WebSocket broadcaster: failed to serialize event "${event}": ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      const openClients = [...clients].filter((c) => c.readyState === c.OPEN);

      for (const client of openClients) {
        try {
          client.send(payload);
        } catch (err) {
          logger.error(`WebSocket broadcaster: failed to send to client: ${err instanceof Error ? err.message : String(err)}`);
          clients.delete(client);
        }
      }

      logger.debug('Broadcast sent', {
        event,
        clientsSent: openClients.length,
      });
    },

    getClientCount: () => clients.size,

    close: () =>
      new Promise<void>((resolve) => {
        for (const client of clients) {
          client.close();
        }
        clients.clear();
        wss.close(() => resolve());
      }),
  };
};
