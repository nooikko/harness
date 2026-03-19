import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  COLLECTION_NAMES: { messages: 'messages', threads: 'threads', files: 'files' },
  upsertPoint: vi.fn().mockResolvedValue(undefined),
}));

const { upsertPoint } = await import('@harness/vector-search');
const { indexText } = await import('../index-text');

describe('indexText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes text into Qdrant messages collection', async () => {
    await indexText({} as never, 'p1', 'Hello world', {
      threadId: 't1',
      role: 'user',
      createdAt: '2026-03-18T00:00:00.000Z',
    });

    expect(upsertPoint).toHaveBeenCalledWith(
      expect.anything(),
      'messages',
      'p1',
      'Hello world',
      expect.objectContaining({ threadId: 't1', role: 'user' }),
    );
  });

  it('skips empty content', async () => {
    await indexText({} as never, 'p1', '', {
      threadId: 't1',
      role: 'user',
      createdAt: '2026-03-18T00:00:00.000Z',
    });

    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('skips whitespace-only content', async () => {
    await indexText({} as never, 'p1', '   \n\t  ', {
      threadId: 't1',
      role: 'user',
      createdAt: '2026-03-18T00:00:00.000Z',
    });

    expect(upsertPoint).not.toHaveBeenCalled();
  });

  it('truncates content to 512 chars', async () => {
    const longContent = 'a'.repeat(1000);
    await indexText({} as never, 'p1', longContent, {
      threadId: 't1',
      role: 'assistant',
      createdAt: '2026-03-18T00:00:00.000Z',
    });

    const calledText = vi.mocked(upsertPoint).mock.calls[0]![3];
    expect(calledText).toHaveLength(512);
  });
});
