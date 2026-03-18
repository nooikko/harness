import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('moveEmail', () => {
  it('moves email to well-known folder', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { moveEmail } = await import('../move-email');

    (graphFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'folder-id', displayName: 'Deleted Items' })
      .mockResolvedValueOnce(undefined);

    const result = await moveEmail({} as Parameters<typeof moveEmail>[0], 'msg-abc123', 'trash');

    expect(result).toContain('Deleted Items');
    expect(graphFetch).toHaveBeenCalledWith(expect.anything(), '/me/mailFolders/deleteditems');
  });

  it('throws when custom folder not found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { moveEmail } = await import('../move-email');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ value: [] });

    await expect(moveEmail({} as Parameters<typeof moveEmail>[0], 'msg-1', 'unknown-folder')).rejects.toThrow('Folder not found');
  });

  it('moves email to custom folder when found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { moveEmail } = await import('../move-email');

    (graphFetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ value: [{ id: 'custom-id', displayName: 'Projects' }] })
      .mockResolvedValueOnce(undefined);

    const result = await moveEmail({} as Parameters<typeof moveEmail>[0], 'msg-abc123', 'Projects');

    expect(result).toContain('Projects');
    const calls = (graphFetch as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[1]).toBe('/me/messages/msg-abc123/move');
    expect(lastCall?.[2]).toMatchObject({
      body: { destinationId: 'custom-id' },
    });
  });

  it('escapes single quotes in folder name filter', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { moveEmail } = await import('../move-email');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ value: [] });

    await expect(moveEmail({} as Parameters<typeof moveEmail>[0], 'msg-abc123', "O'Brien")).rejects.toThrow('Folder not found');

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/mailFolders',
      expect.objectContaining({
        params: expect.objectContaining({
          $filter: "displayName eq 'O''Brien'",
        }),
      }),
    );
  });

  it('throws on invalid messageId', async () => {
    const { moveEmail } = await import('../move-email');

    await expect(moveEmail({} as Parameters<typeof moveEmail>[0], 'abc..def', 'inbox')).rejects.toThrow('Invalid messageId');
  });
});
