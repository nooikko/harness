import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('listFolders', () => {
  it('returns formatted folder list', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolders } = await import('../list-folders');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        { id: 'f1', displayName: 'Inbox', totalItemCount: 100, unreadItemCount: 5 },
        { id: 'f2', displayName: 'Sent Items', totalItemCount: 50, unreadItemCount: 0 },
      ],
    });

    const result = await listFolders({} as Parameters<typeof listFolders>[0]);
    const { text, blocks } = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Inbox');
    expect(parsed[0].unreadItems).toBe(5);
    expect(blocks[0]).toMatchObject({ type: 'email-folders' });
  });

  it('returns empty message when no folders', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolders } = await import('../list-folders');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    const result = await listFolders({} as Parameters<typeof listFolders>[0]);
    expect(result).toBe('No mail folders found.');
  });

  it('returns empty message when data is null', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listFolders } = await import('../list-folders');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await listFolders({} as Parameters<typeof listFolders>[0]);
    expect(result).toBe('No mail folders found.');
  });
});
