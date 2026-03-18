import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateEvent } from '../update-event';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

const ctx = {
  db: {
    calendarEvent: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
} as unknown as Parameters<typeof updateEvent>[0];

describe('updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('updates a local calendar event', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'evt-1',
      source: 'LOCAL',
      title: 'Old Title',
    });
    mockUpdate.mockResolvedValue({
      id: 'evt-1',
      title: 'Updated Title',
    });

    const result = await updateEvent(ctx, {
      eventId: 'evt-1',
      title: 'Updated Title',
    });

    expect(result).toContain('Updated Title');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ title: 'Updated Title' }),
    });
  });

  it('includes all optional fields in update', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'evt-2',
      source: 'LOCAL',
      title: 'Old',
    });
    mockUpdate.mockResolvedValue({
      id: 'evt-2',
      title: 'Full Update',
    });

    await updateEvent(ctx, {
      eventId: 'evt-2',
      title: 'Full Update',
      startAt: '2026-03-17T10:00:00',
      endAt: '2026-03-17T11:00:00',
      location: 'Room 202',
      description: 'Meeting notes',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-2' },
      data: expect.objectContaining({
        title: 'Full Update',
        location: 'Room 202',
        description: 'Meeting notes',
      }),
    });
  });

  it('returns not found when event does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateEvent(ctx, {
      eventId: 'evt-missing',
      title: 'Nope',
    });

    expect(result).toContain('not found');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects non-LOCAL events', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'evt-outlook',
      source: 'OUTLOOK',
      title: 'External',
    });

    const result = await updateEvent(ctx, {
      eventId: 'evt-outlook',
      title: 'Try Edit',
    });

    expect(result).toContain('Cannot edit');
  });
});
