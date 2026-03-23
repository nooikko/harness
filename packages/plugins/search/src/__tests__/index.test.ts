import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  getQdrantClient: vi.fn(),
  ensureCollections: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/backfill', () => ({
  backfill: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/index-text', () => ({
  indexText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/index-thread', () => ({
  indexThread: vi.fn().mockResolvedValue(undefined),
}));

const { getQdrantClient, ensureCollections } = await import('@harness/vector-search');
const { backfill } = await import('../_helpers/backfill');
const { indexText } = await import('../_helpers/index-text');
const { indexThread } = await import('../_helpers/index-thread');
const { plugin } = await import('../index');

const createMockCtx = () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  db: {},
  reportBackgroundError: vi.fn(),
});

describe('search plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('search');
    expect(plugin.version).toBe('1.0.0');
  });

  describe('start', () => {
    it('skips when Qdrant is not configured', async () => {
      vi.mocked(getQdrantClient).mockReturnValue(null);
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);

      expect(ensureCollections).not.toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('plugin disabled'));
    });

    it('ensures collections and starts backfill when Qdrant is available', async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);

      expect(ensureCollections).toHaveBeenCalled();
      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('collections ready'));
    });

    it('logs warning when backfill rejects (non-abort error path)', async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      vi.mocked(backfill).mockRejectedValueOnce(new Error('DB connection failed'));
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);

      await vi.waitFor(() => {
        expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('backfill failed'));
      });
    });

    it('degrades gracefully when Qdrant is unreachable', async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      vi.mocked(ensureCollections).mockRejectedValueOnce(new TypeError('fetch failed'));
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Qdrant unreachable'));
      expect(backfill).not.toHaveBeenCalled();
    });

    it('passes AbortSignal to backfill', async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);

      await vi.waitFor(() => {
        expect(backfill).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.any(AbortSignal));
      });
    });
  });

  describe('stop', () => {
    it('aborts backfill on shutdown', async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);
      await plugin.stop!(ctx as never);

      expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('backfill aborted'));
    });

    it('is safe to call when Qdrant was not configured', async () => {
      vi.mocked(getQdrantClient).mockReturnValue(null);
      const ctx = createMockCtx();

      await plugin.start!(ctx as never);
      await plugin.stop!(ctx as never);

      expect(ctx.logger.info).not.toHaveBeenCalledWith(expect.stringContaining('backfill aborted'));
    });
  });

  describe('register', () => {
    // Hooks check qdrantReady flag which is set by start().
    // Call start() before each hook test so the flag is true.
    beforeEach(async () => {
      vi.mocked(getQdrantClient).mockReturnValue({} as never);
      await plugin.start!(createMockCtx() as never);
      vi.clearAllMocks();
    });

    describe('onMessage', () => {
      it('skips when Qdrant is not configured', async () => {
        vi.mocked(getQdrantClient).mockReturnValue(null);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello');
        expect(indexText).not.toHaveBeenCalled();
      });

      it('skips non-user messages', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'assistant', 'hello');
        expect(indexText).not.toHaveBeenCalled();
      });

      it('logs warning when indexText throws (fire-and-forget error path)', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        vi.mocked(indexText).mockRejectedValueOnce(new Error('Qdrant connection lost'));
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello');

        await vi.waitFor(() => {
          expect(ctx.reportBackgroundError).toHaveBeenCalledWith('indexing', expect.any(Error));
        });
      });

      it('indexes user messages using content param directly (no DB query)', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello world');

        await vi.waitFor(() => {
          expect(indexText).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            'hello world',
            expect.objectContaining({ threadId: 't1', role: 'user' }),
          );
        });
      });
    });

    describe('onPipelineComplete', () => {
      it('skips when Qdrant is not configured', async () => {
        vi.mocked(getQdrantClient).mockReturnValue(null);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', { invokeResult: { output: 'hi' } } as never);
        expect(indexText).not.toHaveBeenCalled();
      });

      it('indexes assistant response from invokeResult.output (not from DB)', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {
          invokeResult: { output: 'response text' },
        } as never);

        await vi.waitFor(() => {
          expect(indexText).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            'response text',
            expect.objectContaining({ threadId: 't1', role: 'assistant' }),
          );
        });
      });

      it('skips assistant indexing when no output', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {
          invokeResult: { output: '' },
        } as never);

        expect(indexText).not.toHaveBeenCalled();
      });

      it('skips indexing when invokeResult is null', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', { invokeResult: null } as never);
        expect(indexText).not.toHaveBeenCalled();
      });

      it('skips indexing when invokeResult is undefined', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {} as never);
        expect(indexText).not.toHaveBeenCalled();
      });

      it('does not re-index thread (moved to onBroadcast)', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {
          invokeResult: { output: 'hi' },
        } as never);

        // indexThread should NOT be called from onPipelineComplete
        expect(indexThread).not.toHaveBeenCalled();
      });
    });

    describe('onBroadcast', () => {
      it('ignores non-thread:name-updated events', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onBroadcast!('pipeline:complete', { threadId: 't1' });
        expect(indexThread).not.toHaveBeenCalled();
      });

      it('skips when Qdrant is not configured', async () => {
        vi.mocked(getQdrantClient).mockReturnValue(null);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onBroadcast!('thread:name-updated', { threadId: 't1', name: 'New Name' });
        expect(indexThread).not.toHaveBeenCalled();
      });

      it('re-indexes thread on thread:name-updated', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onBroadcast!('thread:name-updated', { threadId: 't1', name: 'New Name' });

        await vi.waitFor(() => {
          expect(indexThread).toHaveBeenCalledWith(expect.anything(), expect.anything(), 't1');
        });
      });

      it('logs warning when indexThread throws (fire-and-forget error path)', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        vi.mocked(indexThread).mockRejectedValueOnce(new Error('Qdrant timeout'));
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onBroadcast!('thread:name-updated', { threadId: 't1' });

        await vi.waitFor(() => {
          expect(ctx.reportBackgroundError).toHaveBeenCalledWith('indexing', expect.any(Error));
        });
      });

      it('throws when broadcast data is null', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await expect(hooks.onBroadcast!('thread:name-updated', null as never)).rejects.toThrow();
        expect(indexThread).not.toHaveBeenCalled();
      });

      it('skips when threadId is missing from broadcast data', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onBroadcast!('thread:name-updated', {});
        expect(indexThread).not.toHaveBeenCalled();
      });
    });
  });
});
