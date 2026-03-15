import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  COLLECTION_NAMES: { messages: 'messages', threads: 'threads', files: 'files' },
  upsertPoint: vi.fn().mockResolvedValue(undefined),
}));

const { upsertPoint } = await import('@harness/vector-search');
const { indexThread } = await import('../index-thread');

describe('indexThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes a thread into Qdrant', async () => {
    const db = {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'Test Thread',
          status: 'active',
          agentId: 'a1',
          projectId: 'p1',
          kind: 'chat',
          createdAt: new Date('2026-03-15'),
        }),
      },
    };

    await indexThread({} as never, db as never, 't1');
    expect(upsertPoint).toHaveBeenCalledWith(
      expect.anything(),
      'threads',
      't1',
      'Test Thread',
      expect.objectContaining({ status: 'active', agentId: 'a1' }),
    );
  });

  it('skips when thread not found', async () => {
    const db = { thread: { findUnique: vi.fn().mockResolvedValue(null) } };
    await indexThread({} as never, db as never, 'missing');
    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('skips threads with no name', async () => {
    const db = {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: null,
          status: 'active',
          agentId: null,
          projectId: null,
          kind: 'chat',
          createdAt: new Date(),
        }),
      },
    };
    await indexThread({} as never, db as never, 't1');
    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('skips threads with empty name', async () => {
    const db = {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: '   ',
          status: 'active',
          agentId: null,
          projectId: null,
          kind: 'chat',
          createdAt: new Date(),
        }),
      },
    };
    await indexThread({} as never, db as never, 't1');
    expect(upsertPoint).not.toHaveBeenCalled();
  });
});
