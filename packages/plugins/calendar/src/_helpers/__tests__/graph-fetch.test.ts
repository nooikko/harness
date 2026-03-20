import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetValidToken = vi.fn();
vi.mock('@harness/oauth', () => ({
  getValidToken: (...args: unknown[]) => mockGetValidToken(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { graphFetch } = await import('../graph-fetch');

const ctx = {
  db: {},
} as Parameters<typeof graphFetch>[0];

describe('graphFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetValidToken.mockResolvedValue('test-token');
  });

  it('makes authenticated GET requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: 'data' }),
    });

    const result = await graphFetch(ctx, '/me/events');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.microsoft.com/v1.0/me/events'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(result).toEqual({ value: 'data' });
  });

  it('appends query parameters', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await graphFetch(ctx, '/me/events', { params: { $top: '10' } });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('%24top=10');
  });

  it('throws on error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    await expect(graphFetch(ctx, '/me/events')).rejects.toThrow('Graph API error (403): Forbidden');
  });

  it('returns null for 204 responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await graphFetch(ctx, '/me/events', { method: 'DELETE' });
    expect(result).toBeNull();
  });
});
