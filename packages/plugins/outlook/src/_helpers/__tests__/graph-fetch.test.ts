import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

const mockCtx = {
  db: {},
} as never;

describe('graphFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('makes a GET request with auth header', async () => {
    const mockResponse = { value: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    const result = await graphFetch(mockCtx, '/me/messages');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.microsoft.com/v1.0/me/messages'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-access-token',
        }),
      }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    await expect(graphFetch(mockCtx, '/me/messages')).rejects.toThrow('Graph API error (401)');
  });

  it('adds query params', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    await graphFetch(mockCtx, '/me/messages', { params: { $top: '10' } });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('top=10'), expect.anything());
  });

  it('sends POST with body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    const body = { message: { subject: 'test' } };
    await graphFetch(mockCtx, '/me/sendMail', { method: 'POST', body });

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('returns null for 204 status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );

    const { graphFetch } = await import('../graph-fetch');
    const result = await graphFetch(mockCtx, '/me/sendMail', {
      method: 'POST',
    });

    expect(result).toBeNull();
  });

  it('rejects when getValidToken throws', async () => {
    vi.doMock('@harness/oauth', () => ({
      getValidToken: vi.fn().mockRejectedValue(new Error('Token expired')),
    }));

    const { graphFetch } = await import('../graph-fetch');
    await expect(graphFetch(mockCtx, '/me/messages')).rejects.toThrow('Token expired');
  });
});
