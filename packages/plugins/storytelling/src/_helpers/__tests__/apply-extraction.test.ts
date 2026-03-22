import { describe, expect, it, type Mock, vi } from 'vitest';
import { applyExtraction } from '../apply-extraction';
import type { ExtractionResult } from '../parse-extraction-result';

vi.mock('../find-similar-characters', () => ({
  findSimilarCharacters: vi.fn().mockResolvedValue([]),
}));
vi.mock('../resolve-character-identity', () => ({
  resolveCharacterIdentity: vi.fn().mockReturnValue({ action: 'create' }),
}));
vi.mock('../index-character', () => ({
  indexCharacter: vi.fn().mockResolvedValue(undefined),
}));

type MockDb = {
  storyCharacter: {
    upsert: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  storyLocation: {
    upsert: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  storyMoment: {
    create: ReturnType<typeof vi.fn>;
  };
  characterInMoment: {
    create: ReturnType<typeof vi.fn>;
  };
  story: {
    update: ReturnType<typeof vi.fn>;
  };
};

type CreateMockDb = () => MockDb;

const createMockDb: CreateMockDb = () => ({
  storyCharacter: {
    upsert: vi.fn().mockResolvedValue({ id: 'char-new' }),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
  storyLocation: {
    upsert: vi.fn().mockResolvedValue({ id: 'loc-new' }),
    findFirst: vi.fn().mockResolvedValue(null),
  },
  storyMoment: {
    create: vi.fn().mockResolvedValue({ id: 'moment-new' }),
  },
  characterInMoment: {
    create: vi.fn().mockResolvedValue({}),
  },
  story: {
    update: vi.fn().mockResolvedValue({}),
  },
});

const EMPTY_RESULT: ExtractionResult = {
  characters: [],
  moments: [],
  locations: [],
  scene: null,
  aliases: [],
};

describe('applyExtraction', () => {
  it('creates new characters via upsert', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'Sir Aldric',
          fields: { appearance: 'tall knight', personality: 'brave' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_name: { storyId: 'story-1', name: 'Sir Aldric' } },
        create: expect.objectContaining({
          storyId: 'story-1',
          name: 'Sir Aldric',
          appearance: 'tall knight',
          personality: 'brave',
        }),
      }),
    );
  });

  it('updates existing characters with only provided fields', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'update',
          name: 'Sir Aldric',
          fields: { personality: 'corrupted' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { personality: 'corrupted' },
      }),
    );
  });

  it('processes aliases by adding to character aliases array', async () => {
    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValue({
      id: 'char-1',
      aliases: ['the warrior'],
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      aliases: [{ alias: 'the knight', resolvedName: 'Sir Aldric' }],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyCharacter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1', name: 'Sir Aldric' },
      }),
    );
    expect(db.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'char-1' },
        data: { aliases: { push: 'the knight' } },
      }),
    );
  });

  it('skips alias if already present in character aliases', async () => {
    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValue({
      id: 'char-1',
      aliases: ['the knight'],
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      aliases: [{ alias: 'the knight', resolvedName: 'Sir Aldric' }],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyCharacter.update).not.toHaveBeenCalled();
  });

  it('creates locations with parent resolution', async () => {
    const db = createMockDb();
    db.storyLocation.findFirst.mockResolvedValue({ id: 'loc-parent' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      locations: [
        {
          action: 'create',
          name: 'The Throne Room',
          description: 'A grand hall',
          parentName: 'The Castle',
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyLocation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1', name: 'The Castle' },
      }),
    );
    expect(db.storyLocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          storyId: 'story-1',
          name: 'The Throne Room',
          description: 'A grand hall',
          parentId: 'loc-parent',
        }),
      }),
    );
  });

  it('creates moments with CharacterInMoment records', async () => {
    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValue({ id: 'char-1' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        {
          summary: 'The knight arrived',
          kind: 'action',
          importance: 7,
          characters: [
            {
              name: 'Sir Aldric',
              role: 'protagonist',
              perspective: 'Determined to prove himself',
              emotionalImpact: 'Resolute',
              knowledgeGained: 'The castle is abandoned',
            },
          ],
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyId: 'story-1',
          summary: 'The knight arrived',
          kind: 'action',
          importance: 7,
        }),
      }),
    );

    expect(db.characterInMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          momentId: 'moment-new',
          characterName: 'Sir Aldric',
          characterId: 'char-1',
          role: 'protagonist',
          perspective: 'Determined to prove himself',
          emotionalImpact: 'Resolute',
          knowledgeGained: 'The castle is abandoned',
        }),
      }),
    );
  });

  it('creates moment at new location referenced by newLocationName', async () => {
    const db = createMockDb();
    db.storyLocation.upsert.mockResolvedValue({ id: 'loc-auto' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        {
          summary: 'They entered the forest',
          newLocationName: 'Dark Forest',
          newLocationDescription: 'A dense, foreboding wood',
          kind: 'transition',
          importance: 5,
          characters: [],
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Location upsert for the new location
    expect(db.storyLocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_name: { storyId: 'story-1', name: 'Dark Forest' } },
        create: expect.objectContaining({
          name: 'Dark Forest',
          description: 'A dense, foreboding wood',
        }),
      }),
    );

    // Moment references the new location
    expect(db.storyMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId: 'loc-auto',
        }),
      }),
    );
  });

  it('updates story currentScene when scene is provided', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      scene: {
        characters: ['Sir Aldric', 'Elena'],
        location: 'The Castle',
        storyTime: 'Dawn',
      },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'story-1' },
        data: expect.objectContaining({
          currentScene: {
            characters: ['Sir Aldric', 'Elena'],
            location: 'The Castle',
            storyTime: 'Dawn',
          },
          storyTime: 'Dawn',
        }),
      }),
    );
  });

  it('does not update story when nothing to update', async () => {
    const db = createMockDb();

    await applyExtraction(EMPTY_RESULT, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('updates storyTime from latest moment when scene has no storyTime', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        { summary: 'First', kind: 'action', importance: 5, characters: [], storyTime: 'Noon' },
        { summary: 'Second', kind: 'action', importance: 5, characters: [], storyTime: 'Dusk' },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyTime: 'Dusk',
        }),
      }),
    );
  });

  it('creates moment without optional description field', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        {
          summary: 'A quiet moment',
          kind: 'reflection',
          importance: 3,
          characters: [],
          // no description, no storyTime
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          summary: 'A quiet moment',
          kind: 'reflection',
          importance: 3,
        }),
      }),
    );
    // description should not be in the data
    const call = db.storyMoment.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('description');
  });

  it('creates CharacterInMoment without characterId when character not found in DB', async () => {
    const db = createMockDb();
    // findFirst returns null — character not in DB and not in characterNameToId map
    db.storyCharacter.findFirst.mockResolvedValue(null);

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        {
          summary: 'An unknown character appears',
          kind: 'action',
          importance: 5,
          characters: [{ name: 'Mystery Figure', role: 'antagonist' }],
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.characterInMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          characterName: 'Mystery Figure',
          role: 'antagonist',
        }),
      }),
    );
    // characterId should not be present since character wasn't found
    const call = db.characterInMoment.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('characterId');
  });

  it('merges character when resolution returns merge action', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'merge',
      targetId: 'existing-char-id',
      targetName: 'Sir Aldric',
    });

    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: ['the knight'],
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'Aldric the Brave',
          fields: { personality: 'courageous' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should NOT call upsert — merged into existing
    expect(db.storyCharacter.upsert).not.toHaveBeenCalled();

    // Should add alias
    expect(db.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-char-id' },
        data: { aliases: { push: 'Aldric the Brave' } },
      }),
    );

    // Should update fields on existing record
    expect(db.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-char-id' },
        data: { personality: 'courageous' },
      }),
    );
  });

  it('indexes character in Qdrant after creation', async () => {
    const { indexCharacter } = await import('../index-character');
    const db = createMockDb();
    db.storyCharacter.upsert.mockResolvedValue({ id: 'new-char-id' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'Elena',
          fields: { personality: 'wise healer' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(indexCharacter).toHaveBeenCalledWith('new-char-id', 'Elena', 'wise healer', 'story-1');
  });

  it('skips alias push when name already in aliases during merge', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'merge',
      targetId: 'existing-char-id',
      targetName: 'Sir Aldric',
    });

    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: ['Sir Aldric', 'Aldric the Brave'],
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'Aldric the Brave',
          fields: {},
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should NOT push alias since it already exists, and no fields to update
    expect(db.storyCharacter.update).not.toHaveBeenCalled();
  });

  it('skips updating currentScene when scene data fails Zod validation', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      scene: {
        // characters must be string[], passing numbers will fail the schema
        characters: [123, 456] as unknown as string[],
        location: 'Somewhere',
        storyTime: null,
      },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // story.update should not have been called since scene validation failed and no storyTime
    expect(db.story.update).not.toHaveBeenCalled();
  });
});
