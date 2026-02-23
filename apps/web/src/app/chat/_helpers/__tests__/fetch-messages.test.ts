import type { Message } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { fetchMessages } = await import('../fetch-messages');

type MakeMessage = (overrides: Partial<Message>) => Message;

const makeMessage: MakeMessage = (overrides) => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'user',
  content: 'Hello',
  metadata: null,
  createdAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('fetchMessages', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('queries messages for the given thread ordered by createdAt asc', async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchMessages('thread-123');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-123' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns the messages from the database', async () => {
    const messages = [makeMessage({ id: 'm1', content: 'Hello' }), makeMessage({ id: 'm2', content: 'World' })];
    mockFindMany.mockResolvedValue(messages);

    const result = await fetchMessages('thread-1');

    expect(result).toEqual(messages);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when no messages exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await fetchMessages('empty-thread');

    expect(result).toEqual([]);
  });
});
