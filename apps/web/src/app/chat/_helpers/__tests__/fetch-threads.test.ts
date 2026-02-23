import type { Thread } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    thread: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { fetchThreads } = await import('../fetch-threads');

type MakeThread = (overrides: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-1',
  source: 'web',
  sourceId: 'session-1',
  name: null,
  kind: 'general',
  status: 'open',
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('fetchThreads', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('queries non-archived threads ordered by lastActivity desc', async () => {
    mockFindMany.mockResolvedValue([]);

    await fetchThreads();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: { not: 'archived' } },
      orderBy: { lastActivity: 'desc' },
    });
  });

  it('returns the threads from the database', async () => {
    const threads = [makeThread({ id: 't1' }), makeThread({ id: 't2' })];
    mockFindMany.mockResolvedValue(threads);

    const result = await fetchThreads();

    expect(result).toEqual(threads);
    expect(result).toHaveLength(2);
  });

  it('returns an empty array when no threads exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await fetchThreads();

    expect(result).toEqual([]);
  });
});
