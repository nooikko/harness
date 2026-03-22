import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleRecordMoment } from '../tool-record-moment';

const createMockDb = (opts: { existingLocation?: { id: string } | null; character?: { id: string } | null } = {}) =>
  ({
    storyLocation: {
      findUnique: vi.fn().mockResolvedValue(opts.existingLocation ?? null),
      create: vi.fn().mockResolvedValue({ id: 'loc-new' }),
    },
    storyMoment: {
      create: vi.fn().mockResolvedValue({ id: 'moment-1' }),
    },
    storyCharacter: {
      findFirst: vi.fn().mockResolvedValue(opts.character ?? null),
    },
    characterInMoment: {
      create: vi.fn().mockResolvedValue({}),
    },
  }) as unknown as PrismaClient;

describe('handleRecordMoment', () => {
  it('creates a moment with character perspectives', async () => {
    const db = createMockDb({ character: { id: 'char-1' } });
    const result = await handleRecordMoment(db, 'story-1', {
      summary: 'The knight draws his sword',
      kind: 'action',
      importance: 7,
      characters: [{ name: 'Sir Roland', role: 'protagonist', perspective: 'Determined to fight' }],
    });

    expect(result).toContain('Recorded moment');
    expect(result).toContain('The knight draws his sword');
    expect(result).toContain('1 character(s)');
    expect(db.storyMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        storyId: 'story-1',
        summary: 'The knight draws his sword',
        kind: 'action',
        importance: 7,
      }),
    });
    expect(db.characterInMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        momentId: 'moment-1',
        characterId: 'char-1',
        characterName: 'Sir Roland',
        role: 'protagonist',
        perspective: 'Determined to fight',
      }),
    });
  });

  it('resolves existing location by name', async () => {
    const db = createMockDb({ existingLocation: { id: 'loc-existing' } });
    await handleRecordMoment(db, 'story-1', {
      summary: 'Arrival at the castle',
      locationName: 'Castle Blackthorn',
      kind: 'action',
      importance: 5,
      characters: [],
    });

    expect(db.storyLocation.findUnique).toHaveBeenCalledWith({
      where: { storyId_name: { storyId: 'story-1', name: 'Castle Blackthorn' } },
    });
    expect(db.storyLocation.create).not.toHaveBeenCalled();
    expect(db.storyMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ locationId: 'loc-existing' }),
    });
  });

  it('creates new location when not found', async () => {
    const db = createMockDb({ existingLocation: null });
    await handleRecordMoment(db, 'story-1', {
      summary: 'Entering the forest',
      locationName: 'Dark Forest',
      kind: 'action',
      importance: 3,
      characters: [],
    });

    expect(db.storyLocation.create).toHaveBeenCalledWith({
      data: { storyId: 'story-1', name: 'Dark Forest' },
    });
    expect(db.storyMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ locationId: 'loc-new' }),
    });
  });

  it('handles unknown character gracefully with null characterId', async () => {
    const db = createMockDb({ character: null });
    await handleRecordMoment(db, 'story-1', {
      summary: 'A stranger appears',
      kind: 'revelation',
      importance: 6,
      characters: [{ name: 'Unknown Figure', role: 'antagonist' }],
    });

    expect(db.characterInMoment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        characterId: null,
        characterName: 'Unknown Figure',
      }),
    });
  });
});
