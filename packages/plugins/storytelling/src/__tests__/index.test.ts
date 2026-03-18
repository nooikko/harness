import type { PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

vi.mock('../_helpers/extract-story-state', () => ({
  extractStoryState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/build-cast-injection', () => ({
  buildCastInjection: vi.fn().mockResolvedValue(''),
}));

type CreateMockContext = (overrides?: {
  threadKind?: string;
  storyId?: string | null;
  latestUserContent?: string | null;
  storyUpdatedAt?: Date;
}) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) => {
  const { threadKind = 'general', storyId = null, latestUserContent = null, storyUpdatedAt = new Date(0) } = overrides;

  return {
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({ kind: threadKind, storyId }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(latestUserContent !== null ? { content: latestUserContent } : null),
      },
      story: {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: storyUpdatedAt }),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('storytelling');
    expect(plugin.version).toBe('1.0.0');
  });

  it('has tools array with 6 entries', () => {
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools).toHaveLength(6);
  });

  it('each tool has name, description, schema, and handler', () => {
    for (const tool of plugin.tools ?? []) {
      expect(tool.name).toEqual(expect.any(String));
      expect(tool.description).toEqual(expect.any(String));
      expect(tool.schema).toBeDefined();
      expect(tool.handler).toEqual(expect.any(Function));
    }
  });

  it('tools have expected names', () => {
    const names = (plugin.tools ?? []).map((t) => t.name);
    expect(names).toEqual(['update_character', 'record_moment', 'advance_time', 'add_location', 'character_knowledge', 'get_character']);
  });

  it('tool handler returns error when thread has no cached storyId', async () => {
    const ctx = createMockContext();
    // Do NOT call onBeforeInvoke to prime the cache
    const tool = plugin.tools?.[0];
    const result = await tool?.handler(
      ctx,
      { name: 'Test', field: 'appearance', value: 'tall' },
      {
        threadId: 'uncached-thread',
      },
    );

    expect(result).toBe('This thread is not part of a story.');
  });

  it('registers and returns onBeforeInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onBeforeInvoke).toBeDefined();
    expect(typeof hooks.onBeforeInvoke).toBe('function');
  });

  it('registers and returns onAfterInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks.onAfterInvoke).toBeDefined();
    expect(typeof hooks.onAfterInvoke).toBe('function');
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

  describe('onAfterInvoke', () => {
    it('skips extraction when thread has no storyId', async () => {
      const ctx = createMockContext({ threadKind: 'general', storyId: null });
      const hooks = await plugin.register(ctx);

      // Prime the storyCache via onBeforeInvoke
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      await hooks.onAfterInvoke?.('thread-1', {
        output: 'Some response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).not.toHaveBeenCalled();
    });

    it('calls extractStoryState for story threads', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
        storyUpdatedAt: new Date(0), // old enough to pass dedup guard
      });
      const hooks = await plugin.register(ctx);

      // Prime the storyCache via onBeforeInvoke
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      await hooks.onAfterInvoke?.('thread-1', {
        output: 'The knight entered the castle.',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).toHaveBeenCalledWith(ctx, 'story-1', 'thread-1', 'The knight entered the castle.');
    });

    it('skips extraction within 60-second dedup window', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
        storyUpdatedAt: new Date(), // just now — within dedup window
      });
      const hooks = await plugin.register(ctx);

      // Prime the storyCache
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      await hooks.onAfterInvoke?.('thread-1', {
        output: 'Some response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).not.toHaveBeenCalled();
    });

    it('logs error but does not throw on extraction failure', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
        storyUpdatedAt: new Date(0),
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      vi.mocked(extractStoryState).mockRejectedValueOnce(new Error('DB connection lost'));

      const hooks = await plugin.register(ctx);
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      // Should not throw
      await hooks.onAfterInvoke?.('thread-1', {
        output: 'Some response',
        durationMs: 100,
        exitCode: 0,
      });

      expect(ctx.logger.error).toHaveBeenCalledWith(
        'storytelling: extraction failed',
        expect.objectContaining({
          storyId: 'story-1',
          threadId: 'thread-1',
          error: 'DB connection lost',
        }),
      );
    });

    it('onAfterInvoke is blocking (awaited, not fire-and-forget)', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
        storyUpdatedAt: new Date(0),
      });

      const callOrder: string[] = [];

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      vi.mocked(extractStoryState).mockImplementation(async () => {
        callOrder.push('extract-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('extract-end');
      });

      const hooks = await plugin.register(ctx);
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      await hooks.onAfterInvoke?.('thread-1', {
        output: 'Response',
        durationMs: 100,
        exitCode: 0,
      });

      callOrder.push('after-hook-returned');

      // If it were fire-and-forget, 'after-hook-returned' would appear before 'extract-end'
      expect(callOrder).toEqual(['extract-start', 'extract-end', 'after-hook-returned']);
    });

    it('caches storyId from onBeforeInvoke for use in onAfterInvoke', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
        storyUpdatedAt: new Date(0),
      });
      const hooks = await plugin.register(ctx);

      // Must call onBeforeInvoke first to prime the cache
      await hooks.onBeforeInvoke?.('thread-1', 'prompt');

      await hooks.onAfterInvoke?.('thread-1', {
        output: 'Response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).toHaveBeenCalled();
    });
  });
});
