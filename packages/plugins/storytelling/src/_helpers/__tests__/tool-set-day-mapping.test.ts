import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../compute-day-of-week', async (importOriginal) => {
  const original = await importOriginal<typeof import('../compute-day-of-week')>();
  return {
    ...original,
    computeDayOfWeek: vi.fn(original.computeDayOfWeek),
  };
});

import { computeDayOfWeek as _computeDayOfWeek } from '../compute-day-of-week';
import { handleSetDayMapping } from '../tool-set-day-mapping';

const computeDayOfWeekMock = vi.mocked(_computeDayOfWeek);

const createMockDb = (existingDays: { id: string; dayNumber: number }[] = []) => {
  return {
    story: {
      update: vi.fn().mockResolvedValue({}),
    },
    storyDay: {
      findMany: vi.fn().mockResolvedValue(existingDays),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
};

describe('handleSetDayMapping', () => {
  it('sets dayOfWeekOrigin on story', async () => {
    const db = createMockDb();
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'Monday',
    });

    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dayOfWeekOrigin: 'monday' },
      }),
    );
    expect(result).toContain('Day 1 = monday');
  });

  it('computes day-1 origin from non-day-1 anchor', async () => {
    const db = createMockDb();
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 5,
      dayOfWeek: 'Wednesday',
    });

    // Day 5 = Wednesday → Day 1 = Saturday
    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dayOfWeekOrigin: 'saturday' },
      }),
    );
    expect(result).toContain('Day 1 = saturday');
  });

  it('backfills existing StoryDay records', async () => {
    const existingDays = [
      { id: 'd-1', dayNumber: 1 },
      { id: 'd-2', dayNumber: 2 },
      { id: 'd-3', dayNumber: 3 },
    ];
    const db = createMockDb(existingDays);
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'Monday',
    });

    expect((db as never as { storyDay: { update: ReturnType<typeof vi.fn> } }).storyDay.update).toHaveBeenCalledTimes(3);
    expect((db as never as { storyDay: { update: ReturnType<typeof vi.fn> } }).storyDay.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd-1' }, data: { dayOfWeek: 'monday' } }),
    );
    expect((db as never as { storyDay: { update: ReturnType<typeof vi.fn> } }).storyDay.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd-2' }, data: { dayOfWeek: 'tuesday' } }),
    );
    expect((db as never as { storyDay: { update: ReturnType<typeof vi.fn> } }).storyDay.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd-3' }, data: { dayOfWeek: 'wednesday' } }),
    );
    expect(result).toContain('Updated 3');
  });

  it('rejects invalid day of week', async () => {
    const db = createMockDb();
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'Notaday',
    });

    expect(result).toContain('Error');
    expect(result).toContain('invalid day of week');
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('returns error when computeDayOfWeek returns null for origin', async () => {
    const db = createMockDb();
    computeDayOfWeekMock.mockReturnValueOnce(null);
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'Monday',
    });

    expect(result).toContain('Error');
    expect(result).toContain('could not compute');
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('skips storyDay update when computeDayOfWeek returns null for backfill', async () => {
    const existingDays = [{ id: 'd-1', dayNumber: 1 }];
    const db = createMockDb(existingDays);
    // First call (origin) returns normally, second call (backfill) returns null
    computeDayOfWeekMock.mockReturnValueOnce('monday').mockReturnValueOnce(null);
    const result = await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'Monday',
    });

    expect(db.storyDay.update).not.toHaveBeenCalled();
    expect(result).toContain('Updated 1');
  });

  it('handles case-insensitive input', async () => {
    const db = createMockDb();
    await handleSetDayMapping(db, 'story-1', {
      dayNumber: 1,
      dayOfWeek: 'TUESDAY',
    });

    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dayOfWeekOrigin: 'tuesday' },
      }),
    );
  });
});
