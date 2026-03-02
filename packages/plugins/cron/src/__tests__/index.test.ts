import type { PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cron-server so jobs don't actually schedule
vi.mock('../_helpers/cron-server', () => ({
  createCronServer: vi.fn(),
}));

import { createCronServer } from '../_helpers/cron-server';
import { plugin } from '../index';

const mockCreateCronServer = vi.mocked(createCronServer);

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
  invoker: { invoke: vi.fn() },
  config: {
    claudeModel: 'sonnet',
    databaseUrl: '',
    timezone: 'UTC',
    maxConcurrentAgents: 5,
    claudeTimeout: 30000,
    discordToken: undefined,
    discordChannelId: undefined,
    port: 3001,
    logLevel: 'info',
  } as never,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sendToThread: vi.fn(),
  broadcast: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
});

describe('cron plugin', () => {
  beforeEach(() => {
    mockCreateCronServer.mockClear();
    vi.resetModules();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('cron');
    expect(plugin.version).toBe('1.0.0');
  });

  it('register() returns empty hooks object and logs info', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks).toEqual({});
    expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin registered');
  });

  it('register() returns no hook implementations', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onMessage).toBeUndefined();
    expect(hooks.onBeforeInvoke).toBeUndefined();
    expect(hooks.onAfterInvoke).toBeUndefined();
    expect(hooks.onCommand).toBeUndefined();
    expect(hooks.onBroadcast).toBeUndefined();
  });

  it('start() creates a cron server and calls server.start()', async () => {
    const ctx = createMockContext();
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const mockStop = vi.fn().mockResolvedValue(undefined);

    mockCreateCronServer.mockReturnValueOnce({
      start: mockStart,
      stop: mockStop,
    });

    await plugin.start?.(ctx);

    expect(mockCreateCronServer).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledWith(ctx);
  });

  it('stop() calls the stop handle stored during start()', async () => {
    const ctx = createMockContext();
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const mockStop = vi.fn().mockResolvedValue(undefined);

    mockCreateCronServer.mockReturnValueOnce({
      start: mockStart,
      stop: mockStop,
    });

    await plugin.start?.(ctx);
    await plugin.stop?.(ctx);

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('stop() is a no-op when called before start()', async () => {
    // Import a fresh module instance so stopServer is null
    const { plugin: freshPlugin } = await import('../index');
    const ctx = createMockContext();

    // Should not throw
    await expect(freshPlugin.stop?.(ctx)).resolves.toBeUndefined();
  });
});
