import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('replyEmail', () => {
  it('sends reply via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { replyEmail } = await import('../reply-email');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await replyEmail({} as Parameters<typeof replyEmail>[0], 'msg-abc123', 'Thanks for the update!');

    expect(result).toBe('Reply sent.');
    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/messages/msg-abc123/reply',
      expect.objectContaining({
        method: 'POST',
        body: { comment: 'Thanks for the update!' },
      }),
    );
  });
});
