import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('listRecent', () => {
  it('returns formatted email list', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        {
          id: 'msg-1',
          subject: 'Hello',
          from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
          receivedDateTime: '2026-03-17T10:00:00Z',
          isRead: false,
          bodyPreview: 'Hi there!',
        },
      ],
    });

    const result = await listRecent({} as Parameters<typeof listRecent>[0]);
    const parsed = JSON.parse(result);
    expect(parsed[0].subject).toBe('Hello');
    expect(parsed[0].from).toContain('Alice');
  });

  it('returns empty message when no emails found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    const result = await listRecent({} as Parameters<typeof listRecent>[0], 'sent');
    expect(result).toContain('No emails found');
  });

  it('maps well-known folder names', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    await listRecent({} as Parameters<typeof listRecent>[0], 'trash');
    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/mailFolders/deleteditems/messages', expect.anything());
  });
});
