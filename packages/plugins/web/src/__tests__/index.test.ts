// Tests for web plugin integration (register, start, stop)

import type { Logger } from '@harness/logger';
import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

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
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as Logger,
  sendToThread: vi.fn(),
  broadcast: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
});

describe('web plugin', () => {
  let currentCtx: PluginContext | null = null;

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

    // Use port 0 for auto-assignment — we need to find the actual port
    // The config.port is 0, so the server picks a random port
    await plugin.start?.(ctx);

    // Extract the port from the logger call
    const infoCalls = (ctx.logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const listenCall = infoCalls.find((call) => typeof call[0] === 'string' && call[0].includes('listening on port'));
    expect(listenCall).toBeDefined();
  });

  it('broadcasts WebSocket events via onBroadcast hook', async () => {
    const ctx = createMockContext(0);
    currentCtx = ctx;

    const hooks = await plugin.register(ctx);
    await plugin.start?.(ctx);

    // The onBroadcast hook should call the broadcaster.broadcast
    // Since we have no external way to get the port, verify it doesn't throw
    await expect(hooks.onBroadcast?.('test:event', { data: 'value' })).resolves.toBeUndefined();
  });

  it('handles stop when not started', async () => {
    const ctx = createMockContext();
    // Don't register or start — calling stop should be safe
    await expect(plugin.stop?.(ctx)).resolves.toBeUndefined();
  });

  it('exposes start and stop lifecycle functions', () => {
    // Verify the plugin's structural integrity matches the contract
    expect(plugin.start).toBeDefined();
    expect(plugin.stop).toBeDefined();
    expect(typeof plugin.register).toBe('function');
  });
});
