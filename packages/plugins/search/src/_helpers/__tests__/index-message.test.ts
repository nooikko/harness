import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  COLLECTION_NAMES: { messages: 'messages', threads: 'threads', files: 'files' },
  upsertPoint: vi.fn().mockResolvedValue(undefined),
}));

const { upsertPoint } = await import('@harness/vector-search');
const { indexMessage } = await import('../index-message');

describe('indexMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes a text message into Qdrant', async () => {
    const db = {
      message: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'm1',
          content: 'Hello world',
          role: 'user',
          kind: 'text',
          threadId: 't1',
          createdAt: new Date('2026-03-15'),
        }),
      },
    };

    await indexMessage({} as never, db as never, 'm1');
    expect(upsertPoint).toHaveBeenCalledWith(
      expect.anything(),
      'messages',
      'm1',
      'Hello world',
      expect.objectContaining({ threadId: 't1', role: 'user' }),
    );
  });

  it('skips when message not found', async () => {
    const db = { message: { findUnique: vi.fn().mockResolvedValue(null) } };
    await indexMessage({} as never, db as never, 'missing');
    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('skips non-text messages', async () => {
    const db = {
      message: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'm1',
          content: 'data',
          role: 'user',
          kind: 'status',
          threadId: 't1',
          createdAt: new Date(),
        }),
      },
    };
    await indexMessage({} as never, db as never, 'm1');
    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('skips messages with empty content', async () => {
    const db = {
      message: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'm1',
          content: '   ',
          role: 'user',
          kind: 'text',
          threadId: 't1',
          createdAt: new Date(),
        }),
      },
    };
    await indexMessage({} as never, db as never, 'm1');
    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('truncates content to 512 chars', async () => {
    const longContent = 'a'.repeat(1000);
    const db = {
      message: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'm1',
          content: longContent,
          role: 'assistant',
          kind: 'text',
          threadId: 't1',
          createdAt: new Date('2026-03-15'),
        }),
      },
    };

    await indexMessage({} as never, db as never, 'm1');
    const calledText = vi.mocked(upsertPoint).mock.calls[0]![3];
    expect(calledText).toHaveLength(512);
  });
});
