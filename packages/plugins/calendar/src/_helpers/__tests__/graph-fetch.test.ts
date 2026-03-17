import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

const mockCtx = { db: {} } as Parameters<typeof import('../graph-fetch').graphFetch>[0];

describe('graphFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: [] }),
      }),
    );
  });

  it('makes authenticated GET requests', async () => {
    const { graphFetch } = await import('../graph-fetch');
    await graphFetch(mockCtx, '/me/events');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.microsoft.com/v1.0/me/events'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-access-token',
        }),
      }),
    );
  });

  it('appends query params', async () => {
    const { graphFetch } = await import('../graph-fetch');
    await graphFetch(mockCtx, '/me/events', {
      params: { $top: '10', $select: 'id,subject' },
    });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('%24top=10');
    expect(calledUrl).toContain('%24select=id%2Csubject');
  });

  it('throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    await expect(graphFetch(mockCtx, '/me/events')).rejects.toThrow('Graph API error (403)');
  });

  it('returns null for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    const result = await graphFetch(mockCtx, '/me/events/123', {
      method: 'DELETE',
    });
    expect(result).toBeNull();
  });
});
