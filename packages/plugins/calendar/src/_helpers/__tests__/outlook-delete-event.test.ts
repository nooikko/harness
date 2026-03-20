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

const { outlookDeleteEvent } = await import('../outlook-delete-event');

const mockUpdateMany = vi.fn();
const mockBroadcast = vi.fn();
const ctx = {
  db: {
    calendarEvent: { updateMany: mockUpdateMany },
  },
  broadcast: mockBroadcast,
} as unknown as Parameters<typeof outlookDeleteEvent>[0];

describe('outlookDeleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookDeleteEvent(ctx, 'evt-1');
    expect(result).toContain('Outlook is not connected');
    expect(mockGraphFetch).not.toHaveBeenCalled();
  });

  it('deletes event via Graph API and marks local record as cancelled', async () => {
    mockGraphFetch.mockResolvedValue(null);

    const result = await outlookDeleteEvent(ctx, 'evt-1');

    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/events/evt-1', { method: 'DELETE' });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { source: 'OUTLOOK', externalId: 'evt-1' },
      data: expect.objectContaining({ isCancelled: true }),
    });
    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', { action: 'deleted', eventId: 'evt-1' });
    expect(result).toContain('evt-1');
  });

  it('propagates Graph API errors', async () => {
    mockGraphFetch.mockRejectedValue(new Error('Graph API error (404): Not found'));
    await expect(outlookDeleteEvent(ctx, 'evt-1')).rejects.toThrow('Graph API error');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('marks local CalendarEvent as cancelled after Graph API success', async () => {
    mockGraphFetch.mockResolvedValue(null);

    await outlookDeleteEvent(ctx, 'evt-2');

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: 'OUTLOOK', externalId: 'evt-2' },
        data: expect.objectContaining({ isCancelled: true }),
      }),
    );
  });

  it('does not update local DB or broadcast on Graph API error', async () => {
    mockGraphFetch.mockRejectedValue(new Error('Graph API error (500): Internal Server Error'));

    await expect(outlookDeleteEvent(ctx, 'evt-3')).rejects.toThrow('Graph API error');
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
