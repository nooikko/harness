import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { handleResolveEvent } from '../tool-resolve-event';

const createMockDb = (event: { id: string; what: string; status: string } | null = null) => {
  return {
    storyEvent: {
      findFirst: vi.fn().mockResolvedValue(event),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
};

describe('handleResolveEvent', () => {
  it('marks a pending event as happened', async () => {
    const db = createMockDb({ id: 'e-1', what: 'The gala', status: 'pending' });
    const result = await handleResolveEvent(db, 'story-1', {
      eventId: 'e-1',
      status: 'happened',
    });

    expect(result).toContain('The gala');
    expect(result).toContain('happened');
    expect((db as never as { storyEvent: { update: ReturnType<typeof vi.fn> } }).storyEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e-1' },
        data: expect.objectContaining({ status: 'happened' }),
      }),
    );
  });

  it('marks a pending event as missed', async () => {
    const db = createMockDb({ id: 'e-1', what: 'Call home', status: 'pending' });
    const result = await handleResolveEvent(db, 'story-1', {
      eventId: 'e-1',
      status: 'missed',
    });

    expect(result).toContain('missed');
  });

  it('marks a pending event as cancelled', async () => {
    const db = createMockDb({ id: 'e-1', what: 'Meeting', status: 'pending' });
    const result = await handleResolveEvent(db, 'story-1', {
      eventId: 'e-1',
      status: 'cancelled',
    });

    expect(result).toContain('cancelled');
  });

  it('returns error when event not found', async () => {
    const db = createMockDb(null);
    const result = await handleResolveEvent(db, 'story-1', {
      eventId: 'e-999',
      status: 'happened',
    });

    expect(result).toContain('Error');
    expect(result).toContain('event not found');
  });

  it('returns error when event is already resolved', async () => {
    const db = createMockDb({ id: 'e-1', what: 'The gala', status: 'happened' });
    const result = await handleResolveEvent(db, 'story-1', {
      eventId: 'e-1',
      status: 'missed',
    });

    expect(result).toContain('Error');
    expect(result).toContain('already');
    expect((db as never as { storyEvent: { update: ReturnType<typeof vi.fn> } }).storyEvent.update).not.toHaveBeenCalled();
  });
});
