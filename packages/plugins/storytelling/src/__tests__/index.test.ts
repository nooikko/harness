import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

type CreateMockContext = (overrides?: { threadKind?: string; latestUserContent?: string | null }) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) => {
  const { threadKind = 'general', latestUserContent = null } = overrides;

  return {
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({ kind: threadKind }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(latestUserContent !== null ? { content: latestUserContent } : null),
      },
    } as never,
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
      uploadDir: '/tmp/uploads',
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
    reportStatus: vi.fn(),
  };
};

describe('storytelling plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('storytelling');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onBeforeInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe('function');
  });

  it('returns prompt unchanged for non-storytelling threads', async () => {
    const ctx = createMockContext({ threadKind: 'general' });
    const hooks = await plugin.register(ctx);

    const prompt = 'Hello, world!';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    expect(result).toBe(prompt);
  });

  it('appends formatting instructions for storytelling threads', async () => {
    const ctx = createMockContext({
      threadKind: 'storytelling',
      latestUserContent: 'The knight entered the castle.',
    });
    const hooks = await plugin.register(ctx);

    const prompt = 'The knight entered the castle.';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    expect(result).toContain('Narrative Formatting Conventions');
    expect(result).toContain('**CHARACTER NAME**');
    expect(result).toContain(prompt);
  });

  it('wraps // user message in OOC tags for storytelling threads', async () => {
    const ctx = createMockContext({
      threadKind: 'storytelling',
      latestUserContent: '// make it rain in the next scene',
    });
    const hooks = await plugin.register(ctx);

    const prompt = '// make it rain in the next scene';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    expect(result).toContain('[OUT OF CHARACTER');
    expect(result).toContain('make it rain in the next scene');
    expect(result).toContain('[END OOC]');
    // Also still has formatting instructions
    expect(result).toContain('Narrative Formatting Conventions');
  });

  it('does not wrap // in OOC tags for non-storytelling threads', async () => {
    const ctx = createMockContext({ threadKind: 'general' });
    const hooks = await plugin.register(ctx);

    const prompt = '// this is a comment';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    expect(result).toBe(prompt);
    expect(result).not.toContain('[OUT OF CHARACTER');
  });

  it('handles missing thread gracefully', async () => {
    const ctx = createMockContext();
    (ctx.db as unknown as { thread: { findUnique: ReturnType<typeof vi.fn> } }).thread.findUnique.mockResolvedValue(null);
    const hooks = await plugin.register(ctx);

    const prompt = 'Hello';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    expect(result).toBe(prompt);
  });

  it('handles no user messages gracefully', async () => {
    const ctx = createMockContext({
      threadKind: 'storytelling',
      latestUserContent: null,
    });
    const hooks = await plugin.register(ctx);

    const prompt = 'Hello';
    const result = await hooks.onBeforeInvoke?.('thread-1', prompt);

    // Still appends formatting instructions
    expect(result).toContain('Narrative Formatting Conventions');
    // No OOC wrapping (the instructions mention OOC as a reference, but the wrapping block should not be present)
    expect(result).not.toContain('[END OOC]');
  });
});
