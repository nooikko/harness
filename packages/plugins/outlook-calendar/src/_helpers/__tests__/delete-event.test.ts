import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

const makeCtx = () =>
  ({
    db: { calendarEvent: { updateMany: mockUpdateMany } },
    broadcast: mockBroadcast,
  }) as unknown as Parameters<typeof import('../delete-event').deleteEvent>[0];

describe('deleteEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes an Outlook event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = makeCtx();
    const result = await deleteEvent(ctx, 'evt-1');

    expect(result).toContain('deleted');
    expect(result).toContain('evt-1');
    expect(graphFetch).toHaveBeenCalledWith(ctx, '/me/events/evt-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('propagates Graph API errors', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Graph API error (404): Not Found'));

    const ctx = makeCtx();
    await expect(deleteEvent(ctx, 'missing')).rejects.toThrow('Graph API error (404)');
  });

  it('marks local CalendarEvent as cancelled after Graph API success', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = makeCtx();
    await deleteEvent(ctx, 'evt-2');

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { source: 'OUTLOOK', externalId: 'evt-2' },
      data: expect.objectContaining({ isCancelled: true }),
    });
  });

  it('broadcasts calendar:updated after Graph API success', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = makeCtx();
    await deleteEvent(ctx, 'evt-3');

    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', {
      action: 'deleted',
      eventId: 'evt-3',
    });
  });

  it('does not update local DB or broadcast on Graph API error', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Graph API error (500)'));

    const ctx = makeCtx();
    await expect(deleteEvent(ctx, 'evt-4')).rejects.toThrow();

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
