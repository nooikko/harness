import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    file: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { listThreadFiles } = await import('../list-thread-files');

describe('listThreadFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries files for the given thread', async () => {
    const files = [{ id: 'f1', name: 'a.txt' }];
    mockFindMany.mockResolvedValue(files);

    const result = await listThreadFiles('thread-1');

    expect(result).toEqual(files);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('returns empty array when thread has no files', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listThreadFiles('thread-1');

    expect(result).toEqual([]);
  });
});
