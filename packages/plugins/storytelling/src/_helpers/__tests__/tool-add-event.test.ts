import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleAddEvent } from '../tool-add-event';

const createMockDb = (storyExists = true) => {
  return {
    story: {
      findUnique: vi.fn().mockResolvedValue(storyExists ? { id: 'story-1' } : null),
    },
    storyDay: {
      upsert: vi.fn().mockResolvedValue({ id: 'day-1' }),
    },
    storyEvent: {
      create: vi.fn().mockResolvedValue({ id: 'event-1' }),
    },
  } as unknown as PrismaClient;
};

describe('handleAddEvent', () => {
  it('creates an event with minimal fields', async () => {
    const db = createMockDb();
    const result = await handleAddEvent(db, 'story-1', { what: 'The gala' });

    expect(result).toContain('The gala');
    expect(result).toContain('event-1');
    expect((db as never as { storyEvent: { create: ReturnType<typeof vi.fn> } }).storyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyId: 'story-1',
          what: 'The gala',
          knownBy: [],
        }),
      }),
    );
  });

  it('creates an event with all fields', async () => {
    const db = createMockDb();
    const result = await handleAddEvent(db, 'story-1', {
      what: 'The gala',
      targetDay: 18,
      targetTime: 'evening',
      createdByCharacter: 'Elena',
      knownBy: ['Elena', 'Marcus'],
    });

    expect(result).toContain('Day 18');
    expect(result).toContain('evening');
    expect(result).toContain('event-1');
  });

  it('upserts StoryDay when targetDay is provided', async () => {
    const db = createMockDb();
    await handleAddEvent(db, 'story-1', { what: 'Party', targetDay: 5 });

    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 5 } },
      }),
    );
  });

  it('does not upsert StoryDay when targetDay is omitted', async () => {
    const db = createMockDb();
    await handleAddEvent(db, 'story-1', { what: 'Something vague' });

    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).not.toHaveBeenCalled();
  });

  it('returns error when story not found', async () => {
    const db = createMockDb(false);
    const result = await handleAddEvent(db, 'story-1', { what: 'Nothing' });

    expect(result).toContain('Error');
    expect(result).toContain('story not found');
  });

  it('rejects zero targetDay', async () => {
    const db = createMockDb();
    const result = await handleAddEvent(db, 'story-1', { what: 'Bad event', targetDay: 0 });

    expect(result).toContain('Error');
    expect(result).toContain('positive');
    expect((db as never as { storyEvent: { create: ReturnType<typeof vi.fn> } }).storyEvent.create).not.toHaveBeenCalled();
  });

  it('rejects negative targetDay', async () => {
    const db = createMockDb();
    const result = await handleAddEvent(db, 'story-1', { what: 'Bad event', targetDay: -3 });

    expect(result).toContain('Error');
    expect((db as never as { storyEvent: { create: ReturnType<typeof vi.fn> } }).storyEvent.create).not.toHaveBeenCalled();
  });
});
