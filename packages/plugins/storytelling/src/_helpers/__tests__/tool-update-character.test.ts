import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleUpdateCharacter } from '../tool-update-character';

const createMockDb = (character: { id: string; name: string } | null = null) =>
  ({
    storyCharacter: {
      findFirst: vi.fn().mockResolvedValue(character),
      update: vi.fn().mockResolvedValue({}),
    },
  }) as unknown as PrismaClient;

describe('handleUpdateCharacter', () => {
  it('updates a valid field on an existing character', async () => {
    const db = createMockDb({ id: 'char-1', name: 'Elena' });
    const result = await handleUpdateCharacter(db, 'story-1', {
      name: 'Elena',
      field: 'personality',
      value: 'fierce and determined',
    });

    expect(result).toBe("Updated Elena's personality.");
    expect(db.storyCharacter.update).toHaveBeenCalledWith({
      where: { id: 'char-1' },
      data: { personality: 'fierce and determined' },
    });
  });

  it('returns error for character not found', async () => {
    const db = createMockDb(null);
    const result = await handleUpdateCharacter(db, 'story-1', {
      name: 'Ghost',
      field: 'appearance',
      value: 'translucent',
    });

    expect(result).toContain('Error');
    expect(result).toContain('Ghost');
    expect(result).toContain('not found');
    expect(db.storyCharacter.update).not.toHaveBeenCalled();
  });

  it('returns error for invalid field', async () => {
    const db = createMockDb({ id: 'char-1', name: 'Elena' });
    const result = await handleUpdateCharacter(db, 'story-1', {
      name: 'Elena',
      field: 'height',
      value: '5ft 6in',
    });

    expect(result).toContain('Error');
    expect(result).toContain('invalid field');
    expect(result).toContain('height');
    expect(db.storyCharacter.findFirst).not.toHaveBeenCalled();
  });

  it('uses case-insensitive name matching', async () => {
    const db = createMockDb({ id: 'char-1', name: 'Elena' });
    await handleUpdateCharacter(db, 'story-1', {
      name: 'elena',
      field: 'color',
      value: '#ff0000',
    });

    expect(db.storyCharacter.findFirst).toHaveBeenCalledWith({
      where: {
        storyId: 'story-1',
        name: { equals: 'elena', mode: 'insensitive' },
      },
    });
  });
});
