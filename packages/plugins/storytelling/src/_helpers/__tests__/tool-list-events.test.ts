import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleListEvents } from '../tool-list-events';

const makeEvent = (
  overrides: Partial<{
    id: string;
    what: string;
    targetDay: number | null;
    targetTime: string | null;
    status: string;
    createdByCharacter: string | null;
    knownBy: string[];
  }> = {},
) => ({
  id: 'e-1',
  what: 'The gala',
  targetDay: 18,
  targetTime: 'evening',
  status: 'pending',
  createdByCharacter: 'Elena',
  knownBy: ['Elena', 'Marcus'],
  ...overrides,
});

const createMockDb = (events: ReturnType<typeof makeEvent>[] = []) => {
  return {
    storyEvent: {
      findMany: vi.fn().mockResolvedValue(events),
    },
  } as unknown as PrismaClient;
};

describe('handleListEvents', () => {
  it('returns formatted event list', async () => {
    const db = createMockDb([makeEvent()]);
    const result = await handleListEvents(db, 'story-1', {});

    expect(result).toContain('The gala');
    expect(result).toContain('Day 18');
    expect(result).toContain('evening');
    expect(result).toContain('pending');
    expect(result).toContain('Elena');
  });

  it('returns no events message when empty', async () => {
    const db = createMockDb([]);
    const result = await handleListEvents(db, 'story-1', {});

    expect(result).toBe('No events found.');
  });

  it('filters by status', async () => {
    const db = createMockDb([makeEvent({ status: 'missed' })]);
    await handleListEvents(db, 'story-1', { status: 'missed' });

    expect((db as never as { storyEvent: { findMany: ReturnType<typeof vi.fn> } }).storyEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'missed' }),
      }),
    );
  });

  it('filters by character name', async () => {
    const db = createMockDb([makeEvent()]);
    await handleListEvents(db, 'story-1', { characterName: 'Elena' });

    expect((db as never as { storyEvent: { findMany: ReturnType<typeof vi.fn> } }).storyEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ knownBy: { has: 'Elena' } }),
      }),
    );
  });

  it('handles events with no target day', async () => {
    const db = createMockDb([makeEvent({ targetDay: null })]);
    const result = await handleListEvents(db, 'story-1', {});

    expect(result).toContain('unscheduled');
  });

  it("passes 'all' status without filtering", async () => {
    const db = createMockDb([]);
    await handleListEvents(db, 'story-1', { status: 'all' });

    const call = (db as never as { storyEvent: { findMany: ReturnType<typeof vi.fn> } }).storyEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where).not.toHaveProperty('status');
  });
});
