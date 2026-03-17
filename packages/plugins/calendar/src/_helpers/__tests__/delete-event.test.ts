import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn().mockResolvedValue(null),
}));

describe('deleteEvent', () => {
  it('deletes an event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { deleteEvent } = await import('../delete-event');

    const result = await deleteEvent({} as Parameters<typeof deleteEvent>[0], 'evt-123');

    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/events/evt-123', { method: 'DELETE' });
    expect(result).toContain('deleted');
  });
});
