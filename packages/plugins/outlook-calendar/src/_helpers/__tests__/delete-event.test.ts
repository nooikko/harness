import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('deleteEvent', () => {
  it('deletes an Outlook event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = {} as Parameters<typeof deleteEvent>[0];
    const result = await deleteEvent(ctx, 'evt-1');

    expect(result).toContain('deleted');
    expect(result).toContain('evt-1');
    expect(graphFetch).toHaveBeenCalledWith(ctx, '/me/events/evt-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('propagates Graph API errors', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Graph API error (404): Not Found'));

    const ctx = {} as Parameters<typeof deleteEvent>[0];
    await expect(deleteEvent(ctx, 'missing')).rejects.toThrow('Graph API error (404)');
  });
});
