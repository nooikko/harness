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
vi.mock('../judge-character-match', () => ({
  judgeCharacterMatch: vi.fn().mockResolvedValue(null),
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
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  story: {
    update: ReturnType<typeof vi.fn>;
  };
  storyDay: {
    upsert: ReturnType<typeof vi.fn>;
  };
  storyEvent: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
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
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  story: {
    update: vi.fn().mockResolvedValue({}),
  },
  storyDay: {
    upsert: vi.fn().mockResolvedValue({ id: 'day-1' }),
  },
  storyEvent: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'event-1' }),
  },
});

const EMPTY_TIMELINE = {
  currentDay: null,
  dayTransition: false,
  timeOfDay: null,
  events: [] as { what: string; targetDay: number | null; createdByCharacter: string | null; knownBy: string[] }[],
};

const EMPTY_RESULT: ExtractionResult = {
  characters: [],
  moments: [],
  locations: [],
  scene: null,
  aliases: [],
  timeline: EMPTY_TIMELINE,
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

  it('merge path only updates null fields on existing character, preserving curated data', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'merge',
      targetId: 'existing-char-id',
      targetName: 'Sir Aldric',
    });

    const db = createMockDb();
    // First findFirst: returns existing character for merge (with aliases)
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: [],
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'The Knight',
          fields: { personality: 'vague extraction', appearance: 'new appearance' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // The merge path should call findFirst twice: once for alias check, once for field check
    expect(db.storyCharacter.findFirst).toHaveBeenCalledTimes(2);

    // The second findFirst should select character fields to check for nulls
    const secondCall = db.storyCharacter.findFirst.mock.calls[1]?.[0] as { select: Record<string, boolean> };
    expect(secondCall.select).toHaveProperty('personality', true);
    expect(secondCall.select).toHaveProperty('appearance', true);

    // Since the mock returns null for field values (default), both fields should be written
    const updateCalls = db.storyCharacter.update.mock.calls;
    const fieldUpdateCall = updateCalls.find((c: unknown[]) => {
      const data = (c[0] as { data: Record<string, unknown> }).data;
      return data.personality !== undefined || data.appearance !== undefined;
    });
    expect(fieldUpdateCall).toBeDefined();
    const data = (fieldUpdateCall![0] as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('personality');
    expect(data).toHaveProperty('appearance');
  });

  it('merge path skips fields that already have values on existing character', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'merge',
      targetId: 'existing-char-id',
      targetName: 'Sir Aldric',
    });

    const db = createMockDb();
    // Return existing character with aliases
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: [],
    });
    // Second findFirst returns the full character record with existing personality
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      personality: 'brave warrior — curated by user',
      appearance: null,
      mannerisms: null,
      motives: null,
      backstory: null,
      relationships: null,
      color: null,
      status: null,
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'The Knight',
          fields: { personality: 'vague extraction', appearance: 'tall and armored' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should NOT overwrite personality (already has 'brave warrior')
    // Should write appearance (was null)
    const updateCalls = db.storyCharacter.update.mock.calls;
    const fieldUpdateCall = updateCalls.find((c: unknown[]) => {
      const data = (c[0] as { data: Record<string, unknown> }).data;
      return data.appearance !== undefined || data.personality !== undefined;
    });

    expect(fieldUpdateCall).toBeDefined();
    const data = (fieldUpdateCall![0] as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('appearance', 'tall and armored');
    expect(data).not.toHaveProperty('personality');
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

  // --- Timeline processing tests ---

  it('updates currentDay from timeline and upserts StoryDay', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      timeline: { ...EMPTY_TIMELINE, currentDay: 3 },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 3 } },
        create: { storyId: 'story-1', dayNumber: 3 },
        update: {},
      }),
    );
    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentDay: 3 }),
      }),
    );
  });

  it('creates StoryEvent records from timeline events', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      timeline: {
        ...EMPTY_TIMELINE,
        events: [{ what: 'The gala', targetDay: 5, createdByCharacter: 'Elena', knownBy: ['Elena', 'Aldric'] }],
      },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 5 } },
      }),
    );
    expect(db.storyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyId: 'story-1',
          what: 'The gala',
          targetDay: 5,
          createdByCharacter: 'Elena',
          knownBy: ['Elena', 'Aldric'],
          storyDayId: 'day-1',
        }),
      }),
    );
  });

  it('creates StoryEvent without storyDayId when targetDay is null', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      timeline: {
        ...EMPTY_TIMELINE,
        events: [{ what: 'Someday visit the ruins', targetDay: null, createdByCharacter: null, knownBy: [] }],
      },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyDay.upsert).not.toHaveBeenCalled();
    expect(db.storyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          what: 'Someday visit the ruins',
          targetDay: null,
        }),
      }),
    );
    const call = db.storyEvent.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('storyDayId');
  });

  it('links moment to StoryDay via storyDayId when moment has storyDay', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [{ summary: 'Morning sparring', kind: 'action', importance: 5, characters: [], storyDay: 2 }],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 2 } },
      }),
    );
    expect(db.storyMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyDayId: 'day-1',
        }),
      }),
    );
  });

  it('does not create StoryDay or StoryEvent for empty timeline', async () => {
    const db = createMockDb();

    await applyExtraction(EMPTY_RESULT, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    expect(db.storyDay.upsert).not.toHaveBeenCalled();
    expect(db.storyEvent.create).not.toHaveBeenCalled();
  });

  it('handles dayTransition without currentDay as no-op', async () => {
    const db = createMockDb();
    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      timeline: { ...EMPTY_TIMELINE, dayTransition: true },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // dayTransition without currentDay cannot increment — intentional no-op
    expect(db.storyDay.upsert).not.toHaveBeenCalled();
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('skips CharacterInMoment create when the character already exists in that moment', async () => {
    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValue({ id: 'char-1', aliases: [] });
    // Simulate that the character is already linked to this moment
    db.characterInMoment.findFirst = vi.fn().mockResolvedValue({ id: 'cim-existing' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      moments: [
        {
          summary: 'Scene with existing character',
          kind: 'action',
          importance: 5,
          characters: [{ name: 'Sir Aldric', role: 'protagonist' }],
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should check for existing link first
    expect(db.characterInMoment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          momentId: 'moment-new',
          characterName: 'Sir Aldric',
        }),
      }),
    );

    // Should NOT create a duplicate
    expect(db.characterInMoment.create).not.toHaveBeenCalled();
  });

  // --- Fix 1: Judge character match wiring ---

  it('calls judgeCharacterMatch when resolution is judge and merges on match', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { judgeCharacterMatch } = await import('../judge-character-match');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'judge',
      candidates: [{ characterId: 'existing-char-id', name: 'Sir Aldric', score: 0.75 }],
    });
    // Judge says they match
    (judgeCharacterMatch as Mock).mockResolvedValueOnce('existing-char-id');

    const db = createMockDb();
    // 1st findFirst: candidate description lookup for judge prompt
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      personality: 'brave knight',
      appearance: 'tall',
    });
    // 2nd findFirst: matched character for alias/merge
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: [],
    });
    // 3rd findFirst: field check for null-fill
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      personality: null,
      appearance: null,
      mannerisms: null,
      motives: null,
      backstory: null,
      relationships: null,
      color: null,
      status: null,
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'The Knight',
          fields: { personality: 'brave' },
        },
      ],
    };

    const mockCtx = { invoker: { invoke: vi.fn() }, db } as unknown as Parameters<typeof applyExtraction>[3];
    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1', mockCtx);

    // Should call judgeCharacterMatch
    expect(judgeCharacterMatch).toHaveBeenCalled();

    // Should NOT upsert (should merge into existing)
    expect(db.storyCharacter.upsert).not.toHaveBeenCalled();

    // Should add alias
    expect(db.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-char-id' },
        data: { aliases: { push: 'The Knight' } },
      }),
    );
  });

  it('falls through to create when judge returns no match', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { judgeCharacterMatch } = await import('../judge-character-match');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'judge',
      candidates: [{ characterId: 'maybe-id', name: 'Some Guy', score: 0.7 }],
    });
    // Judge says no match
    (judgeCharacterMatch as Mock).mockResolvedValueOnce(null);

    const db = createMockDb();

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'New Character',
          fields: { personality: 'mysterious' },
        },
      ],
    };

    const mockCtx = { invoker: { invoke: vi.fn() }, db } as unknown as Parameters<typeof applyExtraction>[3];
    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1', mockCtx);

    // Should fall through to upsert
    expect(db.storyCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_name: { storyId: 'story-1', name: 'New Character' } },
      }),
    );
  });

  it('falls through to create when no ctx provided for judge (backward compat)', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'judge',
      candidates: [{ characterId: 'maybe-id', name: 'Some Guy', score: 0.7 }],
    });

    const db = createMockDb();

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'New Character',
          fields: { personality: 'mysterious' },
        },
      ],
    };

    // No ctx provided — backward compatibility
    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should fall through to upsert since judge can't run without ctx
    expect(db.storyCharacter.upsert).toHaveBeenCalled();
  });

  // --- Fix 2: Null-guard on upsert path ---

  it('upsert update path only writes fields that are currently null on existing character', async () => {
    const db = createMockDb();
    // Simulate existing character with personality already set
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      personality: 'already set by user',
      appearance: null,
      mannerisms: null,
      motives: null,
      backstory: null,
      relationships: null,
      color: null,
      status: null,
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'update',
          name: 'Sir Aldric',
          fields: { personality: 'overwrite attempt', appearance: 'tall knight' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Upsert update should only contain appearance (personality already set)
    const upsertCall = db.storyCharacter.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(upsertCall.update).not.toHaveProperty('personality');
    expect(upsertCall.update).toHaveProperty('appearance', 'tall knight');
    // Create clause should still have both (for new records)
    expect(upsertCall.create).toHaveProperty('personality', 'overwrite attempt');
    expect(upsertCall.create).toHaveProperty('appearance', 'tall knight');
  });

  // --- Fix 3: Re-index after merge ---

  it('calls indexCharacter after merge to update Qdrant vectors', async () => {
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { indexCharacter } = await import('../index-character');
    (resolveCharacterIdentity as Mock).mockReturnValueOnce({
      action: 'merge',
      targetId: 'existing-char-id',
      targetName: 'Sir Aldric',
    });

    const db = createMockDb();
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      id: 'existing-char-id',
      aliases: [],
    });
    // Second findFirst for field check
    db.storyCharacter.findFirst.mockResolvedValueOnce({
      personality: null,
      appearance: null,
      mannerisms: null,
      motives: null,
      backstory: null,
      relationships: null,
      color: null,
      status: null,
    });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      characters: [
        {
          action: 'create',
          name: 'The Knight',
          fields: { personality: 'brave' },
        },
      ],
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should re-index after merge
    expect(indexCharacter).toHaveBeenCalledWith('existing-char-id', 'Sir Aldric', 'brave', 'story-1');
  });

  // --- Bug 1: StoryEvent dedup ---

  it('skips StoryEvent create when a duplicate event already exists', async () => {
    const db = createMockDb();
    // findFirst returns an existing event with the same "what"
    db.storyEvent.findFirst.mockResolvedValueOnce({ id: 'existing-event' });

    const result: ExtractionResult = {
      ...EMPTY_RESULT,
      timeline: {
        ...EMPTY_TIMELINE,
        events: [{ what: 'The gala', targetDay: 5, createdByCharacter: 'Elena', knownBy: ['Elena'] }],
      },
    };

    await applyExtraction(result, db as unknown as Parameters<typeof applyExtraction>[1], 'story-1');

    // Should check for existing event first
    expect(db.storyEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1', what: 'The gala' },
      }),
    );

    // Should NOT create a duplicate
    expect(db.storyEvent.create).not.toHaveBeenCalled();
  });
});
