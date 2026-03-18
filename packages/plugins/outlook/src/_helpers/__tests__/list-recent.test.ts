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
    const structured = result as { text: string; blocks: Array<{ type: string; data: Record<string, unknown> }> };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].subject).toBe('Hello');
    expect(parsed[0].from).toContain('Alice');

    expect(structured.blocks).toHaveLength(1);
    expect(structured.blocks[0]?.type).toBe('email-list');
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

  it('handles from: null as Unknown sender', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        {
          id: 'msg-2',
          subject: 'No Sender',
          from: null,
          receivedDateTime: '2026-03-17T10:00:00Z',
          isRead: true,
          bodyPreview: 'Mystery',
        },
      ],
    });

    const result = await listRecent({} as Parameters<typeof listRecent>[0]);
    const structured = result as { text: string };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].from).toBe('Unknown sender');
  });

  it('handles null bodyPreview without crashing', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        {
          id: 'msg-3',
          subject: 'No Preview',
          from: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
          receivedDateTime: '2026-03-17T10:00:00Z',
          isRead: false,
          bodyPreview: null,
        },
      ],
    });

    const result = await listRecent({} as Parameters<typeof listRecent>[0]);
    const structured = result as { text: string };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].preview).toBe('');
  });

  it('passes custom folder name through unchanged', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listRecent } = await import('../list-recent');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    await listRecent({} as Parameters<typeof listRecent>[0], 'MyCustomFolder');
    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/mailFolders/MyCustomFolder/messages', expect.anything());
  });
});
