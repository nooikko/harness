import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  getQdrantClient: vi.fn(),
  ensureCollections: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/backfill', () => ({
  backfill: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/index-message', () => ({
  indexMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/index-thread', () => ({
  indexThread: vi.fn().mockResolvedValue(undefined),
}));

const { getQdrantClient, ensureCollections } = await import('@harness/vector-search');
await import('../_helpers/backfill');
const { indexMessage } = await import('../_helpers/index-message');
const { indexThread } = await import('../_helpers/index-thread');
const { plugin } = await import('../index');

const createMockCtx = () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  db: {
    message: { findFirst: vi.fn().mockResolvedValue(null) },
  },
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
  });

  describe('register', () => {
    it('returns hooks object', async () => {
      const ctx = createMockCtx();
      const hooks = await plugin.register(ctx as never);

      expect(hooks.onMessage).toBeDefined();
      expect(hooks.onPipelineComplete).toBeDefined();
    });

    describe('onMessage', () => {
      it('skips when Qdrant is not configured', async () => {
        vi.mocked(getQdrantClient).mockReturnValue(null);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello');
        expect(indexMessage).not.toHaveBeenCalled();
      });

      it('skips non-user messages', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'assistant', 'hello');
        expect(ctx.db.message.findFirst).not.toHaveBeenCalled();
      });

      it('indexes user messages', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        ctx.db.message.findFirst.mockResolvedValue({ id: 'm1' });
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello');

        // indexMessage is called in background (fire-and-forget)
        await vi.waitFor(() => {
          expect(indexMessage).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'm1');
        });
      });

      it('skips when no message found in DB', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        ctx.db.message.findFirst.mockResolvedValue(null);
        const hooks = await plugin.register(ctx as never);

        await hooks.onMessage!('t1', 'user', 'hello');
        expect(indexMessage).not.toHaveBeenCalled();
      });
    });

    describe('onPipelineComplete', () => {
      it('skips when Qdrant is not configured', async () => {
        vi.mocked(getQdrantClient).mockReturnValue(null);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', { invokeResult: { output: 'hi' } } as never);
        expect(indexMessage).not.toHaveBeenCalled();
        expect(indexThread).not.toHaveBeenCalled();
      });

      it('indexes assistant response and thread', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        (ctx.db as Record<string, unknown>).message = {
          ...ctx.db.message,
          findFirst: vi.fn().mockResolvedValue({ id: 'a1' }),
        };
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {
          invokeResult: { output: 'response text' },
        } as never);

        await vi.waitFor(() => {
          expect(indexMessage).toHaveBeenCalled();
          expect(indexThread).toHaveBeenCalled();
        });
      });

      it('skips assistant indexing when no output', async () => {
        vi.mocked(getQdrantClient).mockReturnValue({} as never);
        const ctx = createMockCtx();
        const hooks = await plugin.register(ctx as never);

        await hooks.onPipelineComplete!('t1', {
          invokeResult: { output: '' },
        } as never);

        // Thread should still be indexed even without output
        await vi.waitFor(() => {
          expect(indexThread).toHaveBeenCalled();
        });
        expect(ctx.db.message.findFirst).not.toHaveBeenCalled();
      });
    });
  });
});
