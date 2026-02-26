import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

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
});

describe('activity plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('activity');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns empty hooks object', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks).toEqual({});
  });
});
