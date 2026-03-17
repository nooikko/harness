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

  it('throws for unknown folder names', async () => {
    const { moveEmail } = await import('../move-email');

    await expect(moveEmail({} as Parameters<typeof moveEmail>[0], 'msg-1', 'unknown-folder')).rejects.toThrow('Unknown folder');
  });
});
