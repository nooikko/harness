// Tests for web plugin integration (register, start, stop)

import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Logger } from '@harness/logger';
import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

let capturedServer: HttpServer | null = null;

vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof import('node:http')>('node:http');
  return {
    ...actual,
    createServer: (...args: Parameters<typeof actual.createServer>) => {
      const server = actual.createServer(...args);
      capturedServer = server;
      return server;
    },
  };
});

// Dynamic import so the mock is in place before the module loads
const { plugin } = await import('../index');

type CreateMockContext = (portOverride?: number) => PluginContext;

const createMockContext: CreateMockContext = (portOverride) => ({
  db: {
    thread: { findMany: vi.fn().mockResolvedValue([]) },
    orchestratorTask: { findMany: vi.fn().mockResolvedValue([]) },
    metric: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PluginContext['db'],
  invoker: {
    invoke: vi.fn(),
  },
  config: {
    port: portOverride ?? 0,
    databaseUrl: 'postgres://test',
    timezone: 'America/Phoenix',
    maxConcurrentAgents: 3,
    claudeModel: 'sonnet',
    claudeTimeout: 300000,
    discordToken: undefined,
    discordChannelId: undefined,
    logLevel: 'info' as const,
    uploadDir: '/tmp/uploads',
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as Logger,
  sendToThread: vi.fn().mockResolvedValue(undefined),
  broadcast: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  reportStatus: vi.fn(),
  uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
});

type GetServerPort = () => number;

const getServerPort: GetServerPort = () => {
  if (!capturedServer) {
    throw new Error('Server not captured — was register() called?');
  }
  const addr = capturedServer.address() as AddressInfo;
  return addr.port;
};

describe('web plugin', () => {
  let currentCtx: PluginContext | null = null;

  beforeEach(() => {
    capturedServer = null;
  });

  afterEach(async () => {
    if (currentCtx) {
      try {
        await plugin.stop?.(currentCtx);
      } catch {
        // ignore cleanup errors
      }
      currentCtx = null;
    }
  });

  it('has correct plugin metadata', () => {
    expect(plugin.name).toBe('web');
    expect(plugin.version).toBe('1.0.0');
    expect(typeof plugin.register).toBe('function');
    expect(typeof plugin.start).toBe('function');
    expect(typeof plugin.stop).toBe('function');
  });

  it('registers and returns hooks with onBroadcast', async () => {
    const ctx = createMockContext();
    currentCtx = ctx;

    const hooks = await plugin.register(ctx);

    expect(hooks).toBeDefined();
    expect(typeof hooks.onBroadcast).toBe('function');
  });

  it('starts and stops the server gracefully', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    await plugin.register(ctx);
    await plugin.start?.(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('Web plugin listening'));

    await plugin.stop?.(ctx);
    currentCtx = null;

    expect(ctx.logger.info).toHaveBeenCalledWith('Web plugin stopped');
  });

  it('serves REST endpoints after start', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    await plugin.register(ctx);
    await plugin.start?.(ctx);

    const port = getServerPort();
    const res = await fetch(`http://localhost:${port}/api/health`);
    const body = (await res.json()) as { status: string };

    expect(res.ok).toBe(true);
    expect(body.status).toBe('ok');
  });

  it('broadcasts WebSocket events via onBroadcast hook', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    const hooks = await plugin.register(ctx);
    await plugin.start?.(ctx);

    const port = getServerPort();

    const received = await new Promise<{ event: string; data: unknown }>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket message not received within timeout'));
      }, 5_000);

      ws.on('open', () => {
        void hooks.onBroadcast?.('test:event', { key: 'value' });
      });

      ws.on('message', (raw: Buffer) => {
        clearTimeout(timeout);
        const parsed = JSON.parse(raw.toString()) as {
          event: string;
          data: unknown;
        };
        ws.close();
        resolve(parsed);
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(received.event).toBe('test:event');
    expect(received.data).toEqual({ key: 'value' });
  });

  it('handles POST /api/chat by broadcasting and sending to thread', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    await plugin.register(ctx);
    await plugin.start?.(ctx);

    const port = getServerPort();
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 't1', content: 'hello' }),
    });

    const body = (await res.json()) as { success: boolean };
    expect(res.ok).toBe(true);
    expect(body.success).toBe(true);

    // broadcast is awaited inside onChatMessage, so it should be called by now
    expect(ctx.broadcast).toHaveBeenCalledWith('chat:message', {
      threadId: 't1',
      content: 'hello',
      role: 'user',
    });

    // sendToThread is fire-and-forget — give it a tick to be called
    await vi.waitFor(() => {
      expect(ctx.sendToThread).toHaveBeenCalledWith('t1', 'hello');
    });
  });

  it('logs error when sendToThread rejects in onChatMessage', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    const sendError = new Error('pipeline exploded');
    (ctx.sendToThread as ReturnType<typeof vi.fn>).mockRejectedValue(sendError);

    await plugin.register(ctx);
    await plugin.start?.(ctx);

    const port = getServerPort();
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 't1', content: 'hello' }),
    });

    expect(res.ok).toBe(true);

    // The .catch() handler in onChatMessage is fire-and-forget — wait for it to settle
    await vi.waitFor(() => {
      expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('sendToThread failed [thread=t1]'));
    });
  });

  it('handles stop when not started', async () => {
    const ctx = createMockContext();
    // Don't register or start — calling stop should be safe
    await expect(plugin.stop?.(ctx)).resolves.toBeUndefined();
  });
});
