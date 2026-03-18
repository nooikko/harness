import { describe, expect, it, vi } from 'vitest';
import { handleAddLocation } from '../tool-add-location';

const createMockDb = (parentLocation: { id: string } | null = null) =>
  ({
    storyLocation: {
      findUnique: vi.fn().mockResolvedValue(parentLocation),
      create: vi.fn().mockResolvedValue({ id: 'loc-new' }),
    },
    locationRelationship: {
      create: vi.fn().mockResolvedValue({}),
    },
  }) as never;

describe('handleAddLocation', () => {
  it('creates a standalone location', async () => {
    const db = createMockDb();
    const result = await handleAddLocation(db, 'story-1', {
      name: 'The Dark Forest',
      description: 'A foreboding woodland',
    });

    expect(result).toContain('Added location "The Dark Forest"');
    expect(db.storyLocation.create).toHaveBeenCalledWith({
      data: {
        storyId: 'story-1',
        name: 'The Dark Forest',
        description: 'A foreboding woodland',
        parentId: undefined,
      },
    });
    expect(db.locationRelationship.create).not.toHaveBeenCalled();
  });

  it('creates a child location with relationship', async () => {
    const db = createMockDb({ id: 'parent-1' });
    const result = await handleAddLocation(db, 'story-1', {
      name: 'Hidden Clearing',
      parentName: 'The Dark Forest',
      distance: '2 miles',
      direction: 'north',
    });

    expect(result).toContain('Added location "Hidden Clearing"');
    expect(result).toContain('Parent: "The Dark Forest"');
    expect(result).toContain('2 miles');
    expect(result).toContain('north');
    expect(db.storyLocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentId: 'parent-1' }),
    });
    expect(db.locationRelationship.create).toHaveBeenCalledWith({
      data: {
        fromId: 'parent-1',
        toId: 'loc-new',
        distance: '2 miles',
        direction: 'north',
      },
    });
  });

  it('returns error when parent location not found', async () => {
    const db = createMockDb(null);
    const result = await handleAddLocation(db, 'story-1', {
      name: 'Secret Cave',
      parentName: 'Nonexistent Mountain',
    });

    expect(result).toContain('Error');
    expect(result).toContain('Nonexistent Mountain');
    expect(result).toContain('not found');
    expect(db.storyLocation.create).not.toHaveBeenCalled();
  });

  it('skips relationship when no distance or direction provided', async () => {
    const db = createMockDb({ id: 'parent-1' });
    await handleAddLocation(db, 'story-1', {
      name: 'Tower Room',
      parentName: 'Castle',
    });

    expect(db.storyLocation.create).toHaveBeenCalled();
    expect(db.locationRelationship.create).not.toHaveBeenCalled();
  });
});
