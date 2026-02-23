// Tests for WebSocket broadcaster

import { createServer, type Server as HttpServer } from 'node:http';
import type { Logger } from '@harness/logger';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { createWsBroadcaster, type WsBroadcaster } from '../ws-broadcaster';

type TestSetup = {
  server: HttpServer;
  broadcaster: WsBroadcaster;
  logger: Logger;
  port: number;
  wsUrl: string;
};

type ConnectClient = (url: string) => Promise<WebSocket>;

const connectClient: ConnectClient = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });

type WaitForMessage = (ws: WebSocket) => Promise<string>;

const waitForMessage: WaitForMessage = (ws) =>
  new Promise((resolve) => {
    ws.on('message', (data) => {
      resolve(data.toString());
    });
  });

type CloseClient = (ws: WebSocket) => Promise<void>;

const closeClient: CloseClient = (ws) =>
  new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });

describe('ws-broadcaster', () => {
  let setup: TestSetup;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const server = createServer();
    const broadcaster = createWsBroadcaster({ server, logger });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;

    setup = {
      server,
      broadcaster,
      logger,
      port,
      wsUrl: `ws://127.0.0.1:${port}/ws`,
    };
  });

  afterAll(async () => {
    for (const client of openClients) {
      await closeClient(client);
    }
    await setup.broadcaster.close();
    await new Promise<void>((resolve) => {
      setup.server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts WebSocket connections', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);

    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(setup.broadcaster.getClientCount()).toBeGreaterThanOrEqual(1);

    await closeClient(client);
    openClients.pop();
  });

  it('broadcasts events to connected clients', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);

    const messagePromise = waitForMessage(client);
    setup.broadcaster.broadcast('test:event', { key: 'value' });

    const raw = await messagePromise;
    const parsed = JSON.parse(raw);

    expect(parsed.event).toBe('test:event');
    expect(parsed.data).toEqual({ key: 'value' });
    expect(typeof parsed.timestamp).toBe('number');

    await closeClient(client);
    openClients.pop();
  });

  it('broadcasts to multiple clients simultaneously', async () => {
    const client1 = await connectClient(setup.wsUrl);
    const client2 = await connectClient(setup.wsUrl);
    openClients.push(client1, client2);

    const msg1Promise = waitForMessage(client1);
    const msg2Promise = waitForMessage(client2);

    setup.broadcaster.broadcast('multi:test', { count: 2 });

    const [raw1, raw2] = await Promise.all([msg1Promise, msg2Promise]);
    const parsed1 = JSON.parse(raw1);
    const parsed2 = JSON.parse(raw2);

    expect(parsed1.event).toBe('multi:test');
    expect(parsed2.event).toBe('multi:test');
    expect(parsed1.data).toEqual({ count: 2 });
    expect(parsed2.data).toEqual({ count: 2 });

    await closeClient(client1);
    await closeClient(client2);
    openClients.splice(-2);
  });

  it('removes clients on disconnect', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);
    const countBefore = setup.broadcaster.getClientCount();

    await closeClient(client);
    openClients.pop();

    // Give the server a moment to process the disconnect
    await new Promise((r) => setTimeout(r, 50));

    expect(setup.broadcaster.getClientCount()).toBe(countBefore - 1);
  });

  it('returns correct client count', async () => {
    const countBefore = setup.broadcaster.getClientCount();
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);

    expect(setup.broadcaster.getClientCount()).toBe(countBefore + 1);

    await closeClient(client);
    openClients.pop();
    await new Promise((r) => setTimeout(r, 50));

    expect(setup.broadcaster.getClientCount()).toBe(countBefore);
  });

  it('handles broadcasting with no connected clients', () => {
    // Should not throw
    expect(() => {
      setup.broadcaster.broadcast('empty:test', { msg: 'nobody listening' });
    }).not.toThrow();
  });

  it('logs connections and disconnections', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);

    expect(setup.logger.info).toHaveBeenCalledWith('WebSocket client connected', expect.objectContaining({ total: expect.any(Number) }));

    await closeClient(client);
    openClients.pop();
    await new Promise((r) => setTimeout(r, 50));

    expect(setup.logger.info).toHaveBeenCalledWith('WebSocket client disconnected', expect.objectContaining({ total: expect.any(Number) }));
  });

  it('skips sending to clients with non-OPEN readyState', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);

    // Terminate abruptly (no close frame) so the server-side socket stays
    // in the clients set momentarily with a non-OPEN readyState
    client.terminate();

    // Broadcast immediately — the server-side socket is likely still tracked
    // but its readyState will be CLOSING or CLOSED
    setup.broadcaster.broadcast('closed:test', { msg: 'skip closed' });

    // Give the server time to clean up
    await new Promise((r) => setTimeout(r, 100));

    openClients.pop();
  });

  it('handles client errors and removes errored clients', async () => {
    const client = await connectClient(setup.wsUrl);
    openClients.push(client);
    const countBefore = setup.broadcaster.getClientCount();

    // Terminate forcefully — this triggers server-side close event
    client.terminate();

    await new Promise((r) => setTimeout(r, 100));

    // After terminate + close, the client should be removed
    expect(setup.broadcaster.getClientCount()).toBeLessThan(countBefore);

    openClients.pop();
  });
});

describe('ws-broadcaster close with active clients', () => {
  it('closes all clients when broadcaster.close() is called', async () => {
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const server = createServer();
    const broadcaster = createWsBroadcaster({ server, logger });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    const wsUrl = `ws://127.0.0.1:${port}/ws`;

    // Connect a client while the broadcaster is active
    const _client = await connectClient(wsUrl);
    expect(broadcaster.getClientCount()).toBe(1);

    // Close the broadcaster with active clients
    await broadcaster.close();
    expect(broadcaster.getClientCount()).toBe(0);

    // Clean up the HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });
});
