import { describe, expect, it, vi } from 'vitest';
import { handleCharacterKnowledge } from '../tool-character-knowledge';

const createMockDb = (
  opts: {
    character?: { id: string; name: string } | null;
    characterMoments?: { characterId: string; characterName: string; momentId: string; knowledgeGained: string | null }[];
    allMoments?: { id: string; summary: string; importance: number }[];
  } = {},
) =>
  ({
    storyCharacter: {
      findFirst: vi.fn().mockResolvedValue(opts.character ?? null),
    },
    characterInMoment: {
      findMany: vi.fn().mockResolvedValue(opts.characterMoments ?? []),
    },
    storyMoment: {
      findMany: vi.fn().mockResolvedValue(opts.allMoments ?? []),
    },
  }) as never;

describe('handleCharacterKnowledge', () => {
  it('returns knowledge state for a character', async () => {
    const db = createMockDb({
      character: { id: 'char-1', name: 'Elena' },
      characterMoments: [{ characterId: 'char-1', characterName: 'Elena', momentId: 'm-1', knowledgeGained: 'The king is dead' }],
      allMoments: [
        { id: 'm-1', summary: 'Discovery of the king', importance: 8 },
        { id: 'm-2', summary: 'Secret meeting in the cellar', importance: 9 },
      ],
    });

    const result = await handleCharacterKnowledge(db, 'story-1', { name: 'Elena' });

    expect(result).toContain('Elena');
    expect(result).toContain('Knows');
    expect(result).toContain('The king is dead');
    expect(result).toContain('Does NOT Know');
    expect(result).toContain('Secret meeting in the cellar');
  });

  it('returns error for character not found', async () => {
    const db = createMockDb({ character: null });
    const result = await handleCharacterKnowledge(db, 'story-1', { name: 'Nobody' });

    expect(result).toContain('Error');
    expect(result).toContain('Nobody');
    expect(result).toContain('not found');
  });

  it('returns empty knowledge message when no moments exist', async () => {
    const db = createMockDb({
      character: { id: 'char-1', name: 'Elena' },
      characterMoments: [],
      allMoments: [],
    });

    const result = await handleCharacterKnowledge(db, 'story-1', { name: 'Elena' });

    expect(result).toContain('No knowledge tracked yet');
  });

  it('filters out soft-deleted moments via deletedAt: null', async () => {
    const db = createMockDb({
      character: { id: 'char-1', name: 'Elena' },
      characterMoments: [],
      allMoments: [],
    });

    await handleCharacterKnowledge(db, 'story-1', { name: 'Elena' });

    expect((db as unknown as { storyMoment: { findMany: ReturnType<typeof vi.fn> } }).storyMoment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1', deletedAt: null },
      }),
    );
  });
});
