import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { listStories } = await import('../list-stories');

describe('listStories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the list of stories from the database', async () => {
    const mockStories = [
      {
        id: 'story-1',
        name: 'The Quest',
        premise: 'A brave journey',
        agentId: 'agent-1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        _count: { threads: 2, characters: 3 },
      },
      {
        id: 'story-2',
        name: 'The Return',
        premise: null,
        agentId: null,
        createdAt: new Date('2026-01-03'),
        updatedAt: new Date('2026-01-04'),
        _count: { threads: 0, characters: 0 },
      },
    ];
    mockFindMany.mockResolvedValue(mockStories);

    const result = await listStories();

    expect(result).toEqual(mockStories);
  });

  it('queries with the correct select and orderBy', async () => {
    mockFindMany.mockResolvedValue([]);

    await listStories();

    expect(mockFindMany).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        premise: true,
        agentId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { threads: true, characters: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('returns an empty array when there are no stories', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listStories();

    expect(result).toEqual([]);
  });
});
