import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteEvent } from '../delete-event';

const mockFindUnique = vi.fn();
const mockDelete = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique, delete: mockDelete } },
} as unknown as Parameters<typeof deleteEvent>[0];

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a local event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', title: 'Old Event', source: 'LOCAL' });
    mockDelete.mockResolvedValue({});

    const result = await deleteEvent(ctx, 'evt-1');
    expect(result).toContain('Deleted');
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'evt-1' } });
  });

  it('returns not found for missing event', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await deleteEvent(ctx, 'missing');
    expect(result).toContain('not found');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('rejects non-LOCAL events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', title: 'Outlook Event', source: 'OUTLOOK' });

    const result = await deleteEvent(ctx, 'evt-2');
    expect(result).toContain('Cannot delete');
    expect(result).toContain('OUTLOOK');
  });
});
