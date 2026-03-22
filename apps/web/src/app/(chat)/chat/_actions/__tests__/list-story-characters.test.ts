import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyCharacter: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { listStoryCharacters } = await import('../list-story-characters');

describe('listStoryCharacters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns characters for the given story', async () => {
    const mockCharacters = [
      {
        id: 'char-1',
        storyId: 'story-1',
        name: 'Alice',
        aliases: ['Al'],
        appearance: 'Tall',
        personality: 'Kind',
        mannerisms: null,
        motives: null,
        backstory: null,
        relationships: null,
        color: '#ff0000',
        status: 'active',
        firstSeenAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ];
    mockFindMany.mockResolvedValue(mockCharacters);

    const result = await listStoryCharacters('story-1');

    expect(result).toEqual(mockCharacters);
  });

  it('queries with the correct where, select, and orderBy', async () => {
    mockFindMany.mockResolvedValue([]);

    await listStoryCharacters('story-1');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { storyId: 'story-1' },
      select: {
        id: true,
        storyId: true,
        name: true,
        aliases: true,
        appearance: true,
        personality: true,
        mannerisms: true,
        motives: true,
        backstory: true,
        relationships: true,
        color: true,
        status: true,
        firstSeenAt: true,
        updatedAt: true,
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  });

  it('returns an empty array when there are no characters', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listStoryCharacters('story-1');

    expect(result).toEqual([]);
  });
});
