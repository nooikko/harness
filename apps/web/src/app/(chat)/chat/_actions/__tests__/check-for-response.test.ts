import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const { checkForResponse } = await import('../check-for-response');

describe('checkForResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when an assistant message exists after the given date', async () => {
    mockFindFirst.mockResolvedValue({ id: 'msg-1' });

    const result = await checkForResponse('thread-1', new Date('2026-02-24T10:00:00Z'));

    expect(result).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        threadId: 'thread-1',
        role: 'assistant',
        createdAt: { gt: new Date('2026-02-24T10:00:00Z') },
      },
      select: { id: true },
    });
  });

  it('returns false when no assistant message exists after the given date', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await checkForResponse('thread-1', new Date('2026-02-24T10:00:00Z'));

    expect(result).toBe(false);
  });
});
