import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckOutlookAuth = vi.fn();
vi.mock('../check-outlook-auth', () => ({
  checkOutlookAuth: (...args: unknown[]) => mockCheckOutlookAuth(...args),
  OUTLOOK_AUTH_ERROR: 'Outlook is not connected. Authenticate at /admin/integrations to use this tool.',
}));

const mockGraphFetch = vi.fn();
vi.mock('../graph-fetch', () => ({
  graphFetch: (...args: unknown[]) => mockGraphFetch(...args),
}));

const { deleteEvent } = await import('../delete-event');

const mockFindUnique = vi.fn();
const mockDeleteMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockBroadcast = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique, deleteMany: mockDeleteMany, updateMany: mockUpdateMany } },
  broadcast: mockBroadcast,
} as unknown as Parameters<typeof deleteEvent>[0];

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('deletes a local event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', title: 'Old Event', source: 'LOCAL', externalId: null });
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

  it('dispatches OUTLOOK events to Graph API DELETE', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', title: 'Outlook Event', source: 'OUTLOOK', externalId: 'graph-id-1' });
    mockGraphFetch.mockResolvedValue(null);

    const result = await deleteEvent(ctx, 'evt-2');

    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/events/graph-id-1', { method: 'DELETE' });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { source: 'OUTLOOK', externalId: 'graph-id-1' },
      data: expect.objectContaining({ isCancelled: true }),
    });
    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', { action: 'deleted', eventId: 'graph-id-1' });
    expect(result).toContain('graph-id-1');
  });

  it('returns auth error for OUTLOOK events when not authenticated', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', title: 'Outlook Event', source: 'OUTLOOK', externalId: 'graph-id-1' });
    mockCheckOutlookAuth.mockResolvedValue(null);

    const result = await deleteEvent(ctx, 'evt-2');
    expect(result).toContain('Outlook is not connected');
    expect(mockGraphFetch).not.toHaveBeenCalled();
  });

  it('returns not supported message for GOOGLE events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-3', title: 'Google Event', source: 'GOOGLE', externalId: 'google-id' });

    const result = await deleteEvent(ctx, 'evt-3');
    expect(result).toContain('not yet supported');
    expect(result).toContain('Google Calendar');
  });

  it('returns auto-generated message for other sources', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-4', title: 'Task Event', source: 'TASK', externalId: null });

    const result = await deleteEvent(ctx, 'evt-4');
    expect(result).toContain('auto-generated');
  });

  it('handles concurrent deletion gracefully when count is 0', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-3', title: 'Gone Event', source: 'LOCAL', externalId: null });
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteEvent(ctx, 'evt-3');
    expect(result).toContain('already deleted or changed');
  });
});
