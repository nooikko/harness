import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleBackfillDays } from '../tool-backfill-days';

const createMockDb = (moments: { id: string }[] = []) => {
  return {
    storyDay: {
      upsert: vi.fn().mockResolvedValue({ id: 'day-1' }),
    },
    storyMoment: {
      findMany: vi.fn().mockResolvedValue(moments),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
};

describe('handleBackfillDays', () => {
  it('creates day records and links moments', async () => {
    const db = createMockDb([{ id: 'm-1' }, { id: 'm-2' }]);
    const result = await handleBackfillDays(db, 'story-1', {
      mapping: { 'Day 1': 1 },
    });

    expect(result).toContain('1 day records ensured');
    expect(result).toContain('2 moments linked');
    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 1 } },
      }),
    );
  });

  it('handles multiple day mappings', async () => {
    const db = createMockDb([{ id: 'm-1' }]);
    const result = await handleBackfillDays(db, 'story-1', {
      mapping: { 'Day 1': 1, 'Day 2': 2, 'Day 3': 3 },
    });

    expect(result).toContain('3 day records ensured');
    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).toHaveBeenCalledTimes(3);
  });

  it('returns error for empty mapping', async () => {
    const db = createMockDb();
    const result = await handleBackfillDays(db, 'story-1', { mapping: {} });

    expect(result).toContain('Error');
    expect(result).toContain('empty');
  });

  it('handles no matching moments gracefully', async () => {
    const db = createMockDb([]);
    const result = await handleBackfillDays(db, 'story-1', {
      mapping: { 'Day 5': 5 },
    });

    expect(result).toContain('1 day records ensured');
    expect(result).toContain('0 moments linked');
  });

  it('queries moments with case-insensitive storyTime match', async () => {
    const db = createMockDb([]);
    await handleBackfillDays(db, 'story-1', {
      mapping: { 'Day 1': 1 },
    });

    expect((db as never as { storyMoment: { findMany: ReturnType<typeof vi.fn> } }).storyMoment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storyTime: { contains: 'Day 1', mode: 'insensitive' },
          storyDayId: null,
        }),
      }),
    );
  });

  it('rejects mapping with zero or negative day numbers', async () => {
    const db = createMockDb();
    const result = await handleBackfillDays(db, 'story-1', {
      mapping: { 'Day 0': 0, 'Day -1': -1 },
    });

    expect(result).toContain('Error');
    expect(result).toContain('positive');
    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).not.toHaveBeenCalled();
  });
});
