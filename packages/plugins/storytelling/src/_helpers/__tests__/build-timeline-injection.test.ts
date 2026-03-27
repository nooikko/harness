import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { buildTimelineInjection } from '../build-timeline-injection';

type MockStory = {
  currentDay: number | null;
  dayOfWeekOrigin: string | null;
  storyTime: string | null;
};

type MockEvent = {
  id: string;
  what: string;
  targetDay: number | null;
  targetTime: string | null;
  status: string;
  createdByCharacter: string | null;
  knownBy: string[];
};

const createMockDb = (story: MockStory | null, events: MockEvent[] = []) => {
  return {
    story: {
      findUnique: vi.fn().mockResolvedValue(story),
    },
    storyEvent: {
      findMany: vi.fn().mockResolvedValue(events),
    },
  } as unknown as PrismaClient;
};

describe('buildTimelineInjection', () => {
  it('returns empty string when story has no currentDay', async () => {
    const db = createMockDb({ currentDay: null, dayOfWeekOrigin: null, storyTime: 'Dawn' });
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toBe('');
  });

  it('returns empty string when story not found', async () => {
    const db = createMockDb(null);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toBe('');
  });

  it('shows current day without day-of-week when origin is not set', async () => {
    const db = createMockDb({ currentDay: 5, dayOfWeekOrigin: null, storyTime: 'Morning, Day 5' });
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('Day 5');
    expect(result).not.toContain('(');
  });

  it('shows current day with day-of-week when origin is set', async () => {
    const db = createMockDb({ currentDay: 3, dayOfWeekOrigin: 'monday', storyTime: 'Morning' });
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('Day 3');
    expect(result).toContain('Wednesday');
  });

  it('shows upcoming events with countdown', async () => {
    const db = createMockDb({ currentDay: 14, dayOfWeekOrigin: null, storyTime: 'Evening' }, [
      {
        id: 'e-1',
        what: 'The gala',
        targetDay: 18,
        targetTime: 'evening',
        status: 'pending',
        createdByCharacter: 'Elena',
        knownBy: ['Elena', 'Marcus'],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('The gala');
    expect(result).toContain('Day 18');
    expect(result).toContain('4 days away');
    expect(result).toContain('Elena');
    expect(result).toContain('Marcus');
  });

  it('flags overdue pending events', async () => {
    const db = createMockDb({ currentDay: 10, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Come back tomorrow',
        targetDay: 8,
        targetTime: null,
        status: 'pending',
        createdByCharacter: 'Kai',
        knownBy: ['Kai', 'Violet'],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('Come back tomorrow');
    expect(result).toContain('OVERDUE');
    expect(result).toContain('2 days');
  });

  it('shows recently missed events', async () => {
    const db = createMockDb({ currentDay: 10, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Call home',
        targetDay: 8,
        targetTime: null,
        status: 'missed',
        createdByCharacter: 'Marcus',
        knownBy: ['Marcus'],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('Call home');
    expect(result).toContain('missed');
  });

  it('caps output to reasonable number of items', async () => {
    const manyEvents: MockEvent[] = Array.from({ length: 20 }, (_, i) => ({
      id: `e-${i}`,
      what: `Event ${i}`,
      targetDay: 15 + i,
      targetTime: null,
      status: 'pending',
      createdByCharacter: null,
      knownBy: [],
    }));
    const db = createMockDb({ currentDay: 14, dayOfWeekOrigin: null, storyTime: 'Morning' }, manyEvents);
    const result = await buildTimelineInjection('story-1', db);
    // Should show at most ~8 items (5 upcoming + 3 overdue/missed)
    const itemCount = (result.match(/^- /gm) ?? []).length;
    expect(itemCount).toBeLessThanOrEqual(8);
  });

  it('shows "tomorrow" for events 1 day away', async () => {
    const db = createMockDb({ currentDay: 5, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Training session',
        targetDay: 6,
        targetTime: null,
        status: 'pending',
        createdByCharacter: null,
        knownBy: [],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('tomorrow');
  });

  it('shows unscheduled pending events', async () => {
    const db = createMockDb({ currentDay: 5, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Someday thing',
        targetDay: null,
        targetTime: null,
        status: 'pending',
        createdByCharacter: null,
        knownBy: [],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('Someday thing');
    expect(result).toContain('unscheduled');
  });

  it('shows overdue by exactly 1 day', async () => {
    const db = createMockDb({ currentDay: 10, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Return the book',
        targetDay: 9,
        targetTime: null,
        status: 'pending',
        createdByCharacter: null,
        knownBy: [],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('OVERDUE by 1 day]');
  });

  it('shows missed 1 day ago', async () => {
    const db = createMockDb({ currentDay: 10, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Forgot the call',
        targetDay: 9,
        targetTime: null,
        status: 'missed',
        createdByCharacter: null,
        knownBy: [],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('1 day ago');
  });

  it('filters out old missed events (>5 days)', async () => {
    const db = createMockDb({ currentDay: 20, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'Ancient event',
        targetDay: 5,
        targetTime: null,
        status: 'missed',
        createdByCharacter: null,
        knownBy: [],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).not.toContain('Ancient event');
  });

  it('shows events happening today', async () => {
    const db = createMockDb({ currentDay: 5, dayOfWeekOrigin: null, storyTime: 'Morning' }, [
      {
        id: 'e-1',
        what: 'The meeting',
        targetDay: 5,
        targetTime: 'afternoon',
        status: 'pending',
        createdByCharacter: null,
        knownBy: ['Quinn'],
      },
    ]);
    const result = await buildTimelineInjection('story-1', db);
    expect(result).toContain('The meeting');
    expect(result).toContain('TODAY');
  });
});
