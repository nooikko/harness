import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

const makeMockEmail = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-1',
  subject: 'Test Email',
  from: {
    emailAddress: { name: 'Alice', address: 'alice@example.com' },
  },
  receivedDateTime: '2026-03-20T10:00:00Z',
  isRead: false,
  hasAttachments: false,
  bodyPreview: 'Hello world',
  ...overrides,
});

describe('listFolderEmails', () => {
  it('returns formatted email list from inbox', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [makeMockEmail()],
    });

    const result = await listFolderEmails({} as Parameters<typeof listFolderEmails>[0]);
    const structured = result as {
      text: string;
      blocks: Array<{
        type: string;
        data: { emails: Array<Record<string, unknown>> };
      }>;
    };

    const parsed = JSON.parse(structured.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Test Email');
    expect(structured.blocks).toHaveLength(1);
    expect(structured.blocks[0]?.type).toBe('email-list');
  });

  it('passes $skip and $top params to graphFetch', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [makeMockEmail()],
    });

    await listFolderEmails({} as Parameters<typeof listFolderEmails>[0], 'inbox', 10, 5);

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/mailFolders/inbox/messages',
      expect.objectContaining({
        params: expect.objectContaining({
          $skip: '10',
          $top: '5',
        }),
      }),
    );
  });

  it('caps take at 50', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [],
    });

    await listFolderEmails({} as Parameters<typeof listFolderEmails>[0], 'inbox', 0, 100);

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({ $top: '50' }),
      }),
    );
  });

  it('maps well-known folder names', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [],
    });

    await listFolderEmails({} as Parameters<typeof listFolderEmails>[0], 'trash');
    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/mailFolders/deleteditems/messages', expect.anything());
  });

  it('passes custom folder name through unchanged', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [],
    });

    await listFolderEmails({} as Parameters<typeof listFolderEmails>[0], 'MyCustomFolder');
    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/mailFolders/MyCustomFolder/messages', expect.anything());
  });

  it('returns empty message when no emails found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [],
    });

    const result = await listFolderEmails({} as Parameters<typeof listFolderEmails>[0], 'sent', 20);
    expect(result).toContain('No emails found');
    expect(result).toContain('skip=20');
  });

  it('detects unsubscribe in bodyPreview', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        makeMockEmail({
          id: 'unsub-1',
          bodyPreview: 'Click here to unsubscribe from this list',
        }),
        makeMockEmail({
          id: 'normal-1',
          bodyPreview: 'Regular email content',
        }),
      ],
    });

    const result = await listFolderEmails({} as Parameters<typeof listFolderEmails>[0]);
    const structured = result as {
      text: string;
      blocks: Array<{
        type: string;
        data: {
          emails: Array<{ id: string; hasUnsubscribeLink: boolean }>;
        };
      }>;
    };

    const emails = structured.blocks[0]?.data.emails ?? [];
    const unsub = emails.find((e) => e.id === 'unsub-1');
    const normal = emails.find((e) => e.id === 'normal-1');
    expect(unsub?.hasUnsubscribeLink).toBe(true);
    expect(normal?.hasUnsubscribeLink).toBe(false);
  });

  it('handles null from field', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [makeMockEmail({ from: null })],
    });

    const result = await listFolderEmails({} as Parameters<typeof listFolderEmails>[0]);
    const structured = result as { text: string };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].from.name).toBe('Unknown sender');
  });

  it('handles null bodyPreview for unsubscribe detection', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [makeMockEmail({ bodyPreview: null })],
    });

    const result = await listFolderEmails({} as Parameters<typeof listFolderEmails>[0]);
    const structured = result as {
      text: string;
      blocks: Array<{
        type: string;
        data: {
          emails: Array<{ hasUnsubscribeLink: boolean }>;
        };
      }>;
    };

    expect(structured.blocks[0]?.data.emails[0]?.hasUnsubscribeLink).toBe(false);
  });

  it('applies default skip=0 and take=20', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolderEmails } = await import('../list-folder-emails');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [],
    });

    await listFolderEmails({} as Parameters<typeof listFolderEmails>[0]);

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        params: expect.objectContaining({
          $skip: '0',
          $top: '20',
        }),
      }),
    );
  });
});
