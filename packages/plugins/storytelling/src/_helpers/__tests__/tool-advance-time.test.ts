import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleAdvanceTime } from '../tool-advance-time';

type MockStory = {
  storyTime: string | null;
  currentDay: number | null;
  dayOfWeekOrigin: string | null;
};

const createMockDb = (story: MockStory | null = null) => {
  const storyDay = {
    upsert: vi.fn().mockResolvedValue({ id: 'day-1' }),
  };

  return {
    story: {
      findUnique: vi.fn().mockResolvedValue(story),
      update: vi.fn().mockResolvedValue({}),
    },
    storyDay,
  } as unknown as PrismaClient;
};

describe('handleAdvanceTime', () => {
  it('advances time and reports previous value', async () => {
    const db = createMockDb({ storyTime: 'Dawn, Day 1', currentDay: null, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Midday, Day 1',
    });

    expect(result).toContain('Dawn, Day 1');
    expect(result).toContain('Midday, Day 1');
    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'story-1' },
        data: expect.objectContaining({ storyTime: 'Midday, Day 1' }),
      }),
    );
  });

  it('returns error when story not found', async () => {
    const db = createMockDb(null);
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Night',
    });

    expect(result).toContain('Error');
    expect(result).toContain('story not found');
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('shows "unset" when previous storyTime is null', async () => {
    const db = createMockDb({ storyTime: null, currentDay: null, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'The beginning',
    });

    expect(result).toContain('unset');
    expect(result).toContain('The beginning');
  });

  it('updates Story.currentDay when storyDay is provided', async () => {
    const db = createMockDb({ storyTime: 'Dawn, Day 1', currentDay: 1, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Morning, Day 2',
      storyDay: 2,
    });

    expect(db.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storyTime: 'Morning, Day 2',
          currentDay: 2,
        }),
      }),
    );
    expect(result).toContain('Day 2');
  });

  it('upserts StoryDay record when storyDay is provided', async () => {
    const db = createMockDb({ storyTime: 'Dawn', currentDay: null, dayOfWeekOrigin: 'monday' });
    await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Morning, Day 3',
      storyDay: 3,
    });

    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId_dayNumber: { storyId: 'story-1', dayNumber: 3 } },
        create: expect.objectContaining({
          storyId: 'story-1',
          dayNumber: 3,
        }),
        update: {},
      }),
    );
  });

  it('computes dayOfWeek on StoryDay when dayOfWeekOrigin is set', async () => {
    const db = createMockDb({ storyTime: 'Dawn', currentDay: 1, dayOfWeekOrigin: 'monday' });
    await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Morning, Day 3',
      storyDay: 3,
    });

    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          dayOfWeek: 'wednesday',
        }),
      }),
    );
  });

  it('does not touch StoryDay when storyDay is omitted', async () => {
    const db = createMockDb({ storyTime: 'Dawn', currentDay: 1, dayOfWeekOrigin: null });
    await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Midday',
    });

    expect((db as never as { storyDay: { upsert: ReturnType<typeof vi.fn> } }).storyDay.upsert).not.toHaveBeenCalled();
  });

  it('reports day advancement in the result message', async () => {
    const db = createMockDb({ storyTime: 'Night, Day 5', currentDay: 5, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Dawn, Day 6',
      storyDay: 6,
    });

    expect(result).toContain('Day 6');
    expect(result).toContain('Dawn, Day 6');
  });

  it('rejects zero storyDay', async () => {
    const db = createMockDb({ storyTime: 'Dawn', currentDay: null, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Morning',
      storyDay: 0,
    });

    expect(result).toContain('Error');
    expect(result).toContain('positive');
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('rejects negative storyDay', async () => {
    const db = createMockDb({ storyTime: 'Dawn', currentDay: null, dayOfWeekOrigin: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Morning',
      storyDay: -1,
    });

    expect(result).toContain('Error');
    expect(db.story.update).not.toHaveBeenCalled();
  });
});
