import { describe, expect, it, vi } from 'vitest';
import { updateEvent } from '../update-event';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique, update: mockUpdate } },
} as unknown as Parameters<typeof updateEvent>[0];

describe('updateEvent', () => {
  it('updates a local event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });
    mockUpdate.mockResolvedValue({ id: 'evt-1', title: 'New Title' });

    const result = await updateEvent(ctx, { eventId: 'evt-1', title: 'New Title' });
    expect(result).toContain('Updated');
    expect(result).toContain('New Title');
  });

  it('includes all optional fields in update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });
    mockUpdate.mockResolvedValue({ id: 'evt-1', title: 'Full Update' });

    await updateEvent(ctx, {
      eventId: 'evt-1',
      title: 'Full Update',
      startAt: '2026-03-17T10:00:00',
      endAt: '2026-03-17T11:00:00',
      isAllDay: true,
      location: 'Room 202',
      description: 'Meeting notes',
      category: 'meeting',
      color: '#FF0000',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        title: 'Full Update',
        isAllDay: true,
        location: 'Room 202',
        description: 'Meeting notes',
        category: 'meeting',
        color: '#FF0000',
      }),
    });
  });

  it('returns not found for missing event', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateEvent(ctx, { eventId: 'missing', title: 'X' });
    expect(result).toContain('not found');
  });

  it('rejects non-LOCAL events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', source: 'OUTLOOK', title: 'External' });

    const result = await updateEvent(ctx, { eventId: 'evt-2', title: 'Try Edit' });
    expect(result).toContain('Cannot edit');
  });
});
