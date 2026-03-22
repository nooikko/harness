import { describe, expect, it, vi } from 'vitest';
import { handleGetCharacter } from '../tool-get-character';

const createMockDb = (
  opts: { character?: Record<string, unknown> | null; allMoments?: { id: string; summary: string; importance: number }[] } = {},
) =>
  ({
    storyCharacter: {
      findFirst: vi.fn().mockResolvedValue(opts.character ?? null),
    },
    storyMoment: {
      findMany: vi.fn().mockResolvedValue(opts.allMoments ?? []),
    },
  }) as never;

describe('handleGetCharacter', () => {
  it('returns full character profile with moments and knowledge', async () => {
    const db = createMockDb({
      character: {
        id: 'char-1',
        name: 'Elena',
        appearance: 'Tall with silver hair',
        personality: 'Stoic but kind',
        mannerisms: null,
        motives: 'Protect the realm',
        backstory: 'Born in the mountains',
        relationships: 'Sister to the prince',
        moments: [
          {
            momentId: 'm-1',
            perspective: 'Felt a surge of power',
            emotionalImpact: 'Awe',
            knowledgeGained: 'The sword is enchanted',
            moment: {
              storyTime: 'Dawn, Day 1',
              summary: 'Finding the enchanted sword',
              location: { name: 'Temple Ruins' },
            },
          },
        ],
      },
      allMoments: [
        { id: 'm-1', summary: 'Finding the enchanted sword', importance: 8 },
        { id: 'm-2', summary: 'Betrayal at court', importance: 9 },
      ],
    });

    const result = await handleGetCharacter(db, 'story-1', { name: 'Elena' });

    expect(result).toContain('### Elena');
    expect(result).toContain('Tall with silver hair');
    expect(result).toContain('Stoic but kind');
    expect(result).toContain('Protect the realm');
    expect(result).toContain('Born in the mountains');
    expect(result).toContain('Sister to the prince');
    expect(result).toContain('Finding the enchanted sword');
    expect(result).toContain('The sword is enchanted');
    expect(result).toContain('Betrayal at court');
  });

  it('returns error for character not found', async () => {
    const db = createMockDb({ character: null });
    const result = await handleGetCharacter(db, 'story-1', { name: 'Nobody' });

    expect(result).toContain('Error');
    expect(result).toContain('Nobody');
    expect(result).toContain('not found');
  });

  it('handles moments with null location', async () => {
    const db = createMockDb({
      character: {
        id: 'char-1',
        name: 'Elena',
        appearance: null,
        personality: 'Brave',
        mannerisms: null,
        motives: null,
        backstory: null,
        relationships: null,
        moments: [
          {
            momentId: 'm-1',
            perspective: 'Felt lost',
            emotionalImpact: 'Confusion',
            knowledgeGained: null,
            moment: {
              storyTime: 'Day 1',
              summary: 'Wandering',
              location: null,
            },
          },
        ],
      },
      allMoments: [{ id: 'm-1', summary: 'Wandering', importance: 3 }],
    });

    const result = await handleGetCharacter(db, 'story-1', { name: 'Elena' });

    expect(result).toContain('### Elena');
    expect(result).toContain('Wandering');
  });

  it('handles character with no moments', async () => {
    const db = createMockDb({
      character: {
        id: 'char-1',
        name: 'Minor Guard',
        appearance: 'Wears standard armor',
        personality: null,
        mannerisms: null,
        motives: null,
        backstory: null,
        relationships: null,
        moments: [],
      },
      allMoments: [],
    });

    const result = await handleGetCharacter(db, 'story-1', { name: 'Minor Guard' });

    expect(result).toContain('### Minor Guard');
    expect(result).toContain('Wears standard armor');
    expect(result).not.toContain('Key moments');
  });
});
