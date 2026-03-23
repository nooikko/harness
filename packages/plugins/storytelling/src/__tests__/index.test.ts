import type { PluginContext } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCaches, plugin } from '../index';

vi.mock('../_helpers/extract-story-state', () => ({
  extractStoryState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/tool-import-characters', () => ({
  handleImportCharacters: vi.fn().mockResolvedValue('Created 2 characters: Violet, Kai.'),
}));

vi.mock('../_helpers/tool-detect-duplicates', () => ({
  handleDetectDuplicates: vi.fn().mockResolvedValue('Found 2 potential duplicate(s).'),
}));

vi.mock('../_helpers/tool-merge-moments', () => ({
  handleMergeMoments: vi.fn().mockResolvedValue('Merged: kept "A", soft-deleted "B".'),
}));

vi.mock('../_helpers/tool-restore-moment', () => ({
  handleRestoreMoment: vi.fn().mockResolvedValue('Restored: "Moment X".'),
}));

vi.mock('../_helpers/tool-correct-moment', () => ({
  handleCorrectMoment: vi.fn().mockResolvedValue('Corrected "Moment X": Updated fields.'),
}));

vi.mock('../_helpers/tool-create-arc', () => ({
  handleCreateArc: vi.fn().mockResolvedValue('Created arc "Suki\'s Mother" with 3 seed moment(s).'),
}));

vi.mock('../_helpers/tool-discover-arc-moments', () => ({
  handleDiscoverArcMoments: vi.fn().mockResolvedValue('Found 5 related moment(s) for arc "Suki\'s Mother".'),
}));

vi.mock('../_helpers/tool-annotate-moment', () => ({
  handleAnnotateMoment: vi.fn().mockResolvedValue('"Violet joined": Annotation updated, linked to 1 arc(s).'),
}));

vi.mock('../_helpers/tool-import-document', () => ({
  handleImportDocument: vi.fn().mockResolvedValue('Processed 1 section(s). Extracted 5 moments.'),
}));

vi.mock('../_helpers/tool-import-transcript', () => ({
  handleImportTranscript: vi.fn().mockResolvedValue('Processed 3 chunk(s) from "Chat 1".'),
}));

vi.mock('../_helpers/build-cast-injection', () => ({
  buildCastInjection: vi.fn().mockResolvedValue(''),
}));

vi.mock('../_helpers/tool-update-character', () => ({
  handleUpdateCharacter: vi.fn().mockResolvedValue("Updated Elena's appearance."),
}));

vi.mock('../_helpers/tool-record-moment', () => ({
  handleRecordMoment: vi.fn().mockResolvedValue('Recorded moment: "The knight arrived" (action, importance 7) with 1 character(s).'),
}));

vi.mock('../_helpers/tool-advance-time', () => ({
  handleAdvanceTime: vi.fn().mockResolvedValue('Story time advanced from "Dawn" to "Dusk".'),
}));

vi.mock('../_helpers/tool-add-location', () => ({
  handleAddLocation: vi.fn().mockResolvedValue('Added location "The Cave".'),
}));

vi.mock('../_helpers/tool-character-knowledge', () => ({
  handleCharacterKnowledge: vi.fn().mockResolvedValue('# Elena — Knowledge State\n\nNo knowledge tracked yet.'),
}));

vi.mock('../_helpers/tool-get-character', () => ({
  handleGetCharacter: vi.fn().mockResolvedValue('# Elena\n\nA fierce warrior.'),
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
    reportBackgroundError: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  };
};

describe('storytelling plugin', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _resetCaches();
    // Restore default mock implementation (previous tests may have overridden with mockImplementation)
    const { extractStoryState } = await import('../_helpers/extract-story-state');
    vi.mocked(extractStoryState).mockResolvedValue(undefined);
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('storytelling');
    expect(plugin.version).toBe('1.0.0');
  });

  it('has tools array with 16 entries', () => {
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools).toHaveLength(16);
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
    expect(names).toEqual([
      'update_character',
      'record_moment',
      'advance_time',
      'add_location',
      'character_knowledge',
      'get_character',
      'import_characters',
      'import_document',
      'import_transcript',
      'detect_duplicates',
      'merge_moments',
      'restore_moment',
      'correct_moment',
      'create_arc',
      'discover_arc_moments',
      'annotate_moment',
    ]);
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

  it('onMessage falls back to DB lookup when storyCache is cold', async () => {
    const ctx = createMockContext({ storyId: 'story-cold' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-cold' } as never);
    const hooks = await plugin.register(ctx);

    // Call onMessage WITHOUT calling onBeforeInvoke first (cold cache)
    await hooks.onMessage?.('cold-cache-thread', 'user', 'not an OOC message');

    // Should have looked up the thread in DB
    expect(ctx.db.thread.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cold-cache-thread' } }));
  });

  it('onMessage with cold cache returns early for non-story thread', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: null } as never);
    const hooks = await plugin.register(ctx);

    // Should not throw
    await hooks.onMessage?.('non-story-thread', 'user', '// rename Violet to Vi');
  });

  it('import tool handler returns error when thread has no story (DB fallback)', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: null } as never);

    const importTool = plugin.tools?.find((t) => t.name === 'import_characters');
    const result = await importTool?.handler(ctx, { text: 'profiles' }, { threadId: 'no-story-thread', traceId: 'test' });

    expect(result).toBe('This thread is not part of a story.');
  });

  it('import_characters delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'import_characters');
    const result = await tool?.handler(ctx, { text: 'Violet profiles' }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Created 2 characters');
  });

  it('import_document delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'import_document');
    const result = await tool?.handler(ctx, { text: 'Day 1 events' }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Extracted 5 moments');
  });

  it('import_transcript delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'import_transcript');
    const result = await tool?.handler(ctx, { transcriptId: 'tx-1' }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Chat 1');
  });

  it('detect_duplicates delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'detect_duplicates');
    const result = await tool?.handler(ctx, {}, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('duplicate');
  });

  it('merge_moments delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'merge_moments');
    const result = await tool?.handler(ctx, { keepId: 'a', discardId: 'b' }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Merged');
  });

  it('restore_moment delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'restore_moment');
    const result = await tool?.handler(ctx, { momentId: 'x' }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Restored');
  });

  it('correct_moment delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);

    const tool = plugin.tools?.find((t) => t.name === 'correct_moment');
    const result = await tool?.handler(ctx, { momentId: 'x', corrections: { summary: 'fixed' } }, { threadId: 'import-thread', traceId: 'test' });

    expect(result).toContain('Corrected');
  });

  it('create_arc delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);
    const tool = plugin.tools?.find((t) => t.name === 'create_arc');
    const result = await tool?.handler(ctx, { name: "Suki's Mother" }, { threadId: 'import-thread', traceId: 'test' });
    expect(result).toContain('Created arc');
  });

  it('discover_arc_moments delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);
    const tool = plugin.tools?.find((t) => t.name === 'discover_arc_moments');
    const result = await tool?.handler(ctx, { arcId: 'arc-1' }, { threadId: 'import-thread', traceId: 'test' });
    expect(result).toContain('related moment');
  });

  it('annotate_moment delegates to handler when story found', async () => {
    const ctx = createMockContext({ storyId: 'story-1' });
    vi.mocked(ctx.db.thread.findUnique).mockResolvedValue({ storyId: 'story-1' } as never);
    const tool = plugin.tools?.find((t) => t.name === 'annotate_moment');
    const result = await tool?.handler(ctx, { momentId: 'mom-1', annotation: 'This matters' }, { threadId: 'import-thread', traceId: 'test' });
    expect(result).toContain('Annotation updated');
  });

  it('stop clears all caches', async () => {
    expect(plugin.stop).toBeDefined();
    await plugin.stop?.({} as PluginContext);
    // After stop, cache is cleared — tool should fall back to DB
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
        storyId: 'story-dedup',
      });
      const hooks = await plugin.register(ctx);

      // Prime the storyCache
      await hooks.onBeforeInvoke?.('thread-dedup', 'prompt');

      // First call — should extract
      await hooks.onAfterInvoke?.('thread-dedup', {
        output: 'First response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).toHaveBeenCalledTimes(1);

      // Second call immediately — should be deduped by in-memory guard
      await hooks.onAfterInvoke?.('thread-dedup', {
        output: 'Second response',
        durationMs: 100,
        exitCode: 0,
      });

      expect(extractStoryState).toHaveBeenCalledTimes(1); // not called again
    });

    it('logs error but does not throw on extraction failure', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-error-test',
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      vi.mocked(extractStoryState).mockRejectedValueOnce(new Error('DB connection lost'));

      const hooks = await plugin.register(ctx);
      await hooks.onBeforeInvoke?.('thread-error-test', 'prompt');

      // Should not throw
      await hooks.onAfterInvoke?.('thread-error-test', {
        output: 'Some response',
        durationMs: 100,
        exitCode: 0,
      });

      expect(ctx.logger.error).toHaveBeenCalledWith(
        'storytelling: extraction failed',
        expect.objectContaining({
          storyId: 'story-error-test',
          threadId: 'thread-error-test',
          error: 'DB connection lost',
        }),
      );
    });

    it('onAfterInvoke is blocking (awaited, not fire-and-forget)', async () => {
      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-blocking',
      });

      const callOrder: string[] = [];

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      vi.mocked(extractStoryState).mockImplementation(async () => {
        callOrder.push('extract-start');
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push('extract-end');
      });

      const hooks = await plugin.register(ctx);
      await hooks.onBeforeInvoke?.('thread-blocking', 'prompt');

      await hooks.onAfterInvoke?.('thread-blocking', {
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
        storyId: 'story-cache-test',
      });
      const hooks = await plugin.register(ctx);

      // Must call onBeforeInvoke first to prime the cache
      await hooks.onBeforeInvoke?.('thread-cache-test', 'prompt');

      await hooks.onAfterInvoke?.('thread-cache-test', {
        output: 'Response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).toHaveBeenCalled();
    });

    it('skips extraction when storyCache has no entry for threadId (onBeforeInvoke never called)', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-1', storyUpdatedAt: new Date(0) });
      const hooks = await plugin.register(ctx);

      // Do NOT call onBeforeInvoke — storyCache has no entry for 'never-primed-thread'
      await hooks.onAfterInvoke?.('never-primed-thread', {
        output: 'Some response',
        durationMs: 100,
        exitCode: 0,
      });

      const { extractStoryState } = await import('../_helpers/extract-story-state');
      expect(extractStoryState).not.toHaveBeenCalled();
    });
  });

  describe('onBeforeInvoke — commandSummary branch', () => {
    it('injects author direction when onMessage processed an OOC command before invoke', async () => {
      // Use a unique threadId to avoid storyCache pollution from other tests
      const threadId = 'ooc-cmd-thread-unique';

      const ctx = {
        db: {
          thread: {
            findUnique: vi.fn().mockResolvedValue({ kind: 'storytelling', storyId: 'ooc-story' }),
          },
          message: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          story: {
            findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
            update: vi.fn().mockResolvedValue({}),
          },
          storyCharacter: {
            findFirst: vi.fn().mockResolvedValue({ id: 'char-1', name: 'Elena', aliases: [] }),
            update: vi.fn().mockResolvedValue({}),
          },
          storyLocation: {
            upsert: vi.fn().mockResolvedValue({ id: 'loc-1' }),
          },
        } as never,
        invoker: { invoke: vi.fn() },
        config: {} as never,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        sendToThread: vi.fn(),
        broadcast: vi.fn().mockResolvedValue(undefined),
        getSettings: vi.fn().mockResolvedValue({}),
        notifySettingsChange: vi.fn().mockResolvedValue(undefined),
        reportStatus: vi.fn(),
        reportBackgroundError: vi.fn(),
        uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
      } as unknown as PluginContext;

      const hooks = await plugin.register(ctx);

      // Prime the storyCache with a valid storyId for this thread
      await hooks.onBeforeInvoke?.(threadId, 'initial prompt');

      // Fire a time OOC command via onMessage — this gets processed and stored in handledOocCommands
      await hooks.onMessage?.(threadId, 'user', "// it's now Midnight");

      // Now call onBeforeInvoke — it should inject the command summary as author direction
      const result = await hooks.onBeforeInvoke?.(threadId, 'The story continues');

      expect(result).toContain('Author direction');
      expect(result).toContain('Continue the story');
    });
  });

  describe('onBeforeInvoke — castInjection branch', () => {
    it('prepends cast injection when buildCastInjection returns non-empty string', async () => {
      const { buildCastInjection } = await import('../_helpers/build-cast-injection');
      vi.mocked(buildCastInjection).mockResolvedValueOnce('## Cast Sheet\n\nElena: tall warrior');

      const ctx = createMockContext({
        threadKind: 'storytelling',
        storyId: 'story-1',
      });

      // story.findUnique for cast injection
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };

      const hooks = await plugin.register(ctx);

      const result = await hooks.onBeforeInvoke?.('thread-cast', 'Tell me the story');

      expect(result).toContain('## Cast Sheet');
      expect(result).toContain('Elena: tall warrior');
      expect(result).toContain('Tell me the story');
    });
  });

  describe('tool happy paths (with primed storyCache)', () => {
    const primeCache = async (ctx: PluginContext, threadId: string, storyId: string) => {
      // Prime via onBeforeInvoke which sets storyCache for the threadId
      const hooks = await plugin.register(ctx);
      await hooks.onBeforeInvoke?.(threadId, 'priming prompt');
      return hooks;
    };

    it('update_character delegates to handleUpdateCharacter when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-1' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-tool', 'story-1');

      const tool = plugin.tools?.find((t) => t.name === 'update_character');
      const result = await tool?.handler(ctx, { name: 'Elena', field: 'appearance', value: 'tall' }, { threadId: 'thread-tool' });

      const { handleUpdateCharacter } = await import('../_helpers/tool-update-character');
      expect(handleUpdateCharacter).toHaveBeenCalledWith(ctx.db, 'story-1', { name: 'Elena', field: 'appearance', value: 'tall' });
      expect(result).toBe("Updated Elena's appearance.");
    });

    it('record_moment delegates to handleRecordMoment when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-2' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-rm', 'story-2');

      const tool = plugin.tools?.find((t) => t.name === 'record_moment');
      const input = { summary: 'The knight arrived', kind: 'action', importance: 7, characters: [] };
      const result = await tool?.handler(ctx, input, { threadId: 'thread-rm' });

      const { handleRecordMoment } = await import('../_helpers/tool-record-moment');
      expect(handleRecordMoment).toHaveBeenCalledWith(ctx.db, 'story-2', input);
      expect(result).toContain('Recorded moment');
    });

    it('advance_time delegates to handleAdvanceTime when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-3' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-at', 'story-3');

      const tool = plugin.tools?.find((t) => t.name === 'advance_time');
      const input = { storyTime: 'Dusk' };
      const result = await tool?.handler(ctx, input, { threadId: 'thread-at' });

      const { handleAdvanceTime } = await import('../_helpers/tool-advance-time');
      expect(handleAdvanceTime).toHaveBeenCalledWith(ctx.db, 'story-3', input);
      expect(result).toContain('Story time advanced');
    });

    it('add_location delegates to handleAddLocation when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-4' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-al', 'story-4');

      const tool = plugin.tools?.find((t) => t.name === 'add_location');
      const input = { name: 'The Cave' };
      const result = await tool?.handler(ctx, input, { threadId: 'thread-al' });

      const { handleAddLocation } = await import('../_helpers/tool-add-location');
      expect(handleAddLocation).toHaveBeenCalledWith(ctx.db, 'story-4', input);
      expect(result).toContain('Added location');
    });

    it('character_knowledge delegates to handleCharacterKnowledge when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-5' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-ck', 'story-5');

      const tool = plugin.tools?.find((t) => t.name === 'character_knowledge');
      const input = { name: 'Elena' };
      const result = await tool?.handler(ctx, input, { threadId: 'thread-ck' });

      const { handleCharacterKnowledge } = await import('../_helpers/tool-character-knowledge');
      expect(handleCharacterKnowledge).toHaveBeenCalledWith(ctx.db, 'story-5', input);
      expect(result).toContain('Knowledge State');
    });

    it('get_character delegates to handleGetCharacter when storyId is cached', async () => {
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: 'story-6' });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date(0), currentScene: null }),
      };
      await primeCache(ctx, 'thread-gc', 'story-6');

      const tool = plugin.tools?.find((t) => t.name === 'get_character');
      const input = { name: 'Elena' };
      const result = await tool?.handler(ctx, input, { threadId: 'thread-gc' });

      const { handleGetCharacter } = await import('../_helpers/tool-get-character');
      expect(handleGetCharacter).toHaveBeenCalledWith(ctx.db, 'story-6', input);
      expect(result).toContain('Elena');
    });

    it('each tool returns "not part of a story" when storyId is null in cache', async () => {
      // Verify for all 6 tools that a null storyId (cached from a non-story thread) returns the error
      const ctx = createMockContext({ threadKind: 'storytelling', storyId: null });
      (ctx.db as unknown as { story: { findUnique: ReturnType<typeof vi.fn> } }).story = {
        findUnique: vi.fn().mockResolvedValue(null),
      };
      const hooks = await plugin.register(ctx);
      // Prime cache with null storyId
      await hooks.onBeforeInvoke?.('null-story-thread', 'prompt');

      for (const tool of plugin.tools ?? []) {
        const result = await tool.handler(
          ctx,
          { name: 'X', field: 'appearance', value: 'v', storyTime: 't', summary: 's', kind: 'k', importance: 1, characters: [] },
          { threadId: 'null-story-thread' },
        );
        expect(result).toBe('This thread is not part of a story.');
      }
    });
  });
});
