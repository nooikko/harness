import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCastInjection } from '../build-cast-injection';

type MockDb = {
  story: { findUnique: ReturnType<typeof vi.fn> };
  storyCharacter: { findMany: ReturnType<typeof vi.fn> };
  storyMoment: { findMany: ReturnType<typeof vi.fn> };
  storyLocation: { findMany: ReturnType<typeof vi.fn> };
};

const createMockDb = (): MockDb => ({
  story: { findUnique: vi.fn() },
  storyCharacter: { findMany: vi.fn() },
  storyMoment: { findMany: vi.fn() },
  storyLocation: { findMany: vi.fn() },
});

const storyId = 'story-1';

const makeCharacter = (
  overrides: {
    name?: string;
    personality?: string | null;
    motives?: string | null;
    appearance?: string | null;
    mannerisms?: string | null;
    backstory?: string | null;
    relationships?: string | null;
    updatedAt?: Date;
    moments?: Array<{
      characterId: string | null;
      characterName: string;
      momentId: string;
      knowledgeGained: string | null;
      perspective: string | null;
      emotionalImpact: string | null;
      moment: {
        storyTime: string | null;
        summary: string;
        importance: number;
        location: { name: string } | null;
      };
    }>;
  } = {},
) => ({
  id: `char-${overrides.name ?? 'default'}`,
  storyId,
  name: overrides.name ?? 'Default',
  appearance: overrides.appearance ?? null,
  personality: overrides.personality ?? null,
  mannerisms: overrides.mannerisms ?? null,
  motives: overrides.motives ?? null,
  backstory: overrides.backstory ?? null,
  relationships: overrides.relationships ?? null,
  status: 'active',
  updatedAt: overrides.updatedAt ?? new Date(Date.now() - 2 * 60 * 60 * 1000),
  moments: overrides.moments ?? [],
});

describe('buildCastInjection', () => {
  let db: MockDb;

  beforeEach(() => {
    db = createMockDb();
    db.story.findUnique.mockResolvedValue({ storyTime: 'November 14, evening' });
    db.storyMoment.findMany.mockResolvedValue([]);
    db.storyLocation.findMany.mockResolvedValue([]);
  });

  it('returns minimal string when no characters exist', async () => {
    db.storyCharacter.findMany.mockResolvedValue([]);

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, null, db as any);

    expect(result).toContain('# Story State');
    expect(result).toContain('No characters established yet.');
    expect(result).toContain('Story time: November 14, evening');
  });

  it('assigns characters in currentScene to Tier 1 with full detail', async () => {
    const sam = makeCharacter({
      name: 'Sam',
      personality: 'Guarded',
      appearance: 'Tall',
      moments: [
        {
          characterId: 'char-Sam',
          characterName: 'Sam',
          momentId: 'm1',
          knowledgeGained: 'The truth',
          perspective: 'Shocked',
          emotionalImpact: 'Deeply shaken',
          moment: {
            storyTime: 'Nov 13',
            summary: 'Discovered the letter.',
            importance: 8,
            location: { name: 'The Study' },
          },
        },
      ],
    });
    db.storyCharacter.findMany.mockResolvedValue([sam]);
    db.storyMoment.findMany.mockResolvedValue([{ id: 'm1', summary: 'Discovered the letter.', importance: 8 }]);

    const scene = { characters: ['Sam'], locationName: 'The Study' };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('## In Scene');
    expect(result).toContain('### Sam');
    expect(result).toContain('Appearance: Tall');
    expect(result).toContain('Personality: Guarded');
    expect(result).toContain('Discovered the letter.');
    expect(result).toContain('Knows: The truth');
  });

  it('assigns recently updated characters not in scene to Tier 2', async () => {
    const elena = makeCharacter({
      name: 'Elena',
      personality: 'Warm and open',
      updatedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    });
    db.storyCharacter.findMany.mockResolvedValue([elena]);

    const scene = { characters: ['Sam'] };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('## Recently Active');
    expect(result).toContain('- Elena: Warm and open');
    expect(result).not.toContain('### Elena');
  });

  it('assigns old characters not in scene to Tier 3 background', async () => {
    const marcus = makeCharacter({
      name: 'Marcus',
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    });
    db.storyCharacter.findMany.mockResolvedValue([marcus]);

    const scene = { characters: ['Sam'] };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('Background: Marcus');
    expect(result).not.toContain('### Marcus');
  });

  it('puts all characters in Tier 2 when no currentScene', async () => {
    const char1 = makeCharacter({
      name: 'Alpha',
      personality: 'Bold',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    const char2 = makeCharacter({
      name: 'Beta',
      motives: 'Survival',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    db.storyCharacter.findMany.mockResolvedValue([char1, char2]);

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, null, db as any);

    expect(result).toContain('## Recently Active');
    expect(result).toContain('- Alpha: Bold');
    expect(result).toContain('- Beta: Survival');
    expect(result).not.toContain('## In Scene');
  });

  it('includes location context when currentScene has locationName', async () => {
    db.storyCharacter.findMany.mockResolvedValue([makeCharacter({ name: 'Sam', updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })]);
    db.storyLocation.findMany.mockResolvedValue([
      {
        id: 'loc-1',
        name: 'The Study',
        description: 'A dimly lit room filled with books.',
        relationsFrom: [
          { to: { name: 'The Garden' }, distance: 'adjacent', direction: 'east' },
          { to: { name: 'The Library' }, distance: null, direction: 'north' },
        ],
      },
    ]);

    const scene = { characters: [], locationName: 'The Study' };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('## Location');
    expect(result).toContain('Current: The Study');
    expect(result).toContain('A dimly lit room filled with books.');
    expect(result).toContain('Nearby:');
    expect(result).toContain('- The Garden (adjacent) [east]');
    expect(result).toContain('- The Library [north]');
  });

  it('appends story time at the end', async () => {
    db.storyCharacter.findMany.mockResolvedValue([]);
    db.story.findUnique.mockResolvedValue({ storyTime: 'Dawn, Day 3' });

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, null, db as any);

    expect(result).toContain('Story time: Dawn, Day 3');
  });

  it('omits story time when null', async () => {
    db.storyCharacter.findMany.mockResolvedValue([]);
    db.story.findUnique.mockResolvedValue({ storyTime: null });

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, null, db as any);

    expect(result).not.toContain('Story time:');
  });

  it('case-insensitive character matching for scene presence', async () => {
    const sam = makeCharacter({ name: 'Sam', personality: 'Cool' });
    db.storyCharacter.findMany.mockResolvedValue([sam]);

    const scene = { characters: ['sam'] };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('## In Scene');
    expect(result).toContain('### Sam');
  });

  it('uses motives as fallback trait for Tier 2 when personality is null', async () => {
    const char = makeCharacter({
      name: 'Ghost',
      personality: null,
      motives: 'Revenge',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    db.storyCharacter.findMany.mockResolvedValue([char]);

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, null, db as any);

    expect(result).toContain('- Ghost: Revenge');
  });

  it('derives doesNotKnow for Tier 1 characters from missed high-importance moments', async () => {
    const sam = makeCharacter({
      name: 'Sam',
      personality: 'Guarded',
      moments: [],
    });
    db.storyCharacter.findMany.mockResolvedValue([sam]);
    db.storyMoment.findMany.mockResolvedValue([{ id: 'm-secret', summary: 'Marcus returned to town', importance: 9 }]);

    const scene = { characters: ['Sam'] };
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const result = await buildCastInjection(storyId, scene, db as any);

    expect(result).toContain('Does NOT know: Marcus returned to town');
  });
});
