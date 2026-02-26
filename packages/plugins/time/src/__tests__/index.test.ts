import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/format-time', () => ({
  formatTime: vi.fn().mockReturnValue('Thursday, February 26, 2026 at 8:30:00 AM MST'),
}));

import { formatTime } from '../_helpers/format-time';
import { plugin } from '../index';

const mockFormatTime = vi.mocked(formatTime);

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
  invoker: { invoke: vi.fn() },
  config: {
    claudeModel: 'sonnet',
    databaseUrl: '',
    timezone: 'America/Phoenix',
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

describe('time plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('time');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onBeforeInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe('function');
  });

  it('replaces /current-time with formatted time in prompt', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'What is /current-time right now?');

    expect(result).toBe('What is [Current time: Thursday, February 26, 2026 at 8:30:00 AM MST] right now?');
    expect(mockFormatTime).toHaveBeenCalledWith({ timezone: 'America/Phoenix' });
  });

  it('returns prompt unchanged when /current-time is not present', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', 'Hello, what time is it?');

    expect(result).toBe('Hello, what time is it?');
  });

  it('replaces multiple occurrences of /current-time', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    const result = await hooks.onBeforeInvoke?.('thread-1', '/current-time and also /current-time');

    expect(result).toBe(
      '[Current time: Thursday, February 26, 2026 at 8:30:00 AM MST] and also [Current time: Thursday, February 26, 2026 at 8:30:00 AM MST]',
    );
  });
});

describe('time plugin tools', () => {
  it('defines a current_time tool', () => {
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools).toHaveLength(1);

    const tool = plugin.tools?.[0];
    expect(tool?.name).toBe('current_time');
    expect(tool?.description).toContain('current date and time');
  });

  it('current_time tool returns formatted time', async () => {
    const ctx = createMockContext();
    const tool = plugin.tools?.[0];

    const result = await tool?.handler(ctx, {}, { threadId: 'thread-1' });

    expect(result).toBe('Thursday, February 26, 2026 at 8:30:00 AM MST');
    expect(mockFormatTime).toHaveBeenCalledWith({ timezone: 'America/Phoenix' });
  });
});
