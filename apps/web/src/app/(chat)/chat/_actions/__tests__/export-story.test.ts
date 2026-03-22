import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { exportStory } = await import('../export-story');

const makeStory = (overrides: Record<string, unknown> = {}) => ({
  id: 'story-1',
  name: 'Volleyball Story',
  premise: 'A team of volleyball players',
  storyTime: 'Day 11, Afternoon',
  currentScene: { characters: ['Violet', 'Kai'], location: 'Gym' },
  createdAt: new Date('2026-03-01'),
  characters: [
    {
      id: 'char-1',
      name: 'Violet',
      aliases: ['Vi'],
      appearance: 'Tall',
      personality: 'Guarded but kind',
      mannerisms: null,
      motives: 'Find belonging',
      backstory: "Lonely billionaire's daughter",
      relationships: 'Close to Kai',
      color: '#8b5cf6',
      status: 'active',
      importNotes: null,
    },
  ],
  locations: [
    {
      id: 'loc-1',
      name: 'The Gym',
      description: 'Where the team practices',
      parentId: null,
      relationsFrom: [{ toId: 'loc-2', distance: 'across the street', direction: 'north', notes: null }],
      relationsTo: [],
    },
  ],
  moments: [
    {
      id: 'mom-1',
      summary: 'Violet joined the team',
      description: 'First practice together',
      storyTime: 'Day 1, Morning',
      locationId: 'loc-1',
      kind: 'bonding',
      importance: 8,
      sourceNotes: 'From summary doc Days 1-3',
      annotation: 'This is where it all started',
      deletedAt: null,
      createdAt: new Date('2026-03-01'),
      characters: [
        {
          characterId: 'char-1',
          characterName: 'Violet',
          role: 'protagonist',
          perspective: 'Nervous but hopeful',
          emotionalImpact: 'First real connection',
          knowledgeGained: null,
          relationshipContext: 'Team accepts her immediately',
        },
      ],
      arcs: [{ arc: { name: "Violet's Integration" } }],
    },
  ],
  arcs: [
    {
      id: 'arc-1',
      name: "Violet's Integration",
      description: 'How Violet became part of the team',
      status: 'resolved',
      importance: 9,
      annotation: 'Core arc of the first week',
      moments: [
        {
          moment: { id: 'mom-1', summary: 'Violet joined the team', storyTime: 'Day 1, Morning' },
        },
      ],
    },
  ],
  transcripts: [
    {
      id: 'tx-1',
      label: 'Chat 1',
      sourceType: 'claude',
      processed: true,
      processedThrough: 30,
      totalChunks: 30,
      messageCount: 400,
      createdAt: new Date('2026-03-01'),
    },
  ],
  ...overrides,
});

describe('exportStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a complete story as JSON with all entities', async () => {
    mockFindUnique.mockResolvedValue(makeStory());

    const result = await exportStory('story-1');

    expect('data' in result).toBe(true);
    if (!('data' in result)) {
      return;
    }

    const parsed = JSON.parse(result.data);
    expect(parsed.version).toBe(1);
    expect(parsed.story.name).toBe('Volleyball Story');
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.characters[0].name).toBe('Violet');
    expect(parsed.locations).toHaveLength(1);
    expect(parsed.moments).toHaveLength(1);
    expect(parsed.moments[0].characters).toHaveLength(1);
    expect(parsed.moments[0].arcs).toEqual(["Violet's Integration"]);
    expect(parsed.arcs).toHaveLength(1);
    expect(parsed.arcs[0].momentIds).toEqual(['mom-1']);
    expect(parsed.transcripts).toHaveLength(1);
  });

  it('generates a kebab-case filename with date', async () => {
    mockFindUnique.mockResolvedValue(makeStory());

    const result = await exportStory('story-1');

    expect('filename' in result).toBe(true);
    if (!('filename' in result)) {
      return;
    }

    expect(result.filename).toMatch(/^volleyball-story-export-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('includes relationship context in exported character moments', async () => {
    mockFindUnique.mockResolvedValue(makeStory());

    const result = await exportStory('story-1');

    expect('data' in result).toBe(true);
    if (!('data' in result)) {
      return;
    }

    const parsed = JSON.parse(result.data);
    expect(parsed.moments[0].characters[0].relationshipContext).toBe('Team accepts her immediately');
  });

  it('returns error for empty story ID', async () => {
    const result = await exportStory('');

    expect(result).toEqual({ error: 'Story ID is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error when story not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await exportStory('nonexistent');

    expect(result).toEqual({ error: 'Story not found' });
  });

  it('returns error on database failure', async () => {
    mockFindUnique.mockRejectedValue(new Error('Connection lost'));

    const result = await exportStory('story-1');

    expect(result).toEqual({ error: 'Failed to export story' });
  });

  it('filters out soft-deleted moments via deletedAt: null', async () => {
    mockFindUnique.mockResolvedValue(makeStory());

    await exportStory('story-1');

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          moments: expect.objectContaining({
            where: { deletedAt: null },
          }),
        }),
      }),
    );
  });
});
