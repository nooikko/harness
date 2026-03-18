import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteEvent } from '../delete-event';

const mockFindUnique = vi.fn();
const mockDeleteMany = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique, deleteMany: mockDeleteMany } },
} as unknown as Parameters<typeof deleteEvent>[0];

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('deletes a local event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', title: 'Old Event', source: 'LOCAL' });
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteEvent(ctx, 'evt-1');
    expect(result).toContain('deleted');
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { id: 'evt-1', source: 'LOCAL' } });
  });

  it('returns not found for missing event', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await deleteEvent(ctx, 'missing');
    expect(result).toContain('not found');
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('rejects non-LOCAL events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', title: 'Outlook Event', source: 'OUTLOOK' });

    const result = await deleteEvent(ctx, 'evt-2');
    expect(result).toContain('Cannot delete');
    expect(result).toContain('OUTLOOK');
  });

  it('handles concurrent deletion gracefully when count is 0', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-3', title: 'Gone Event', source: 'LOCAL' });
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteEvent(ctx, 'evt-3');
    expect(result).toContain('already deleted or changed');
  });
});
