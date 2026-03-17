import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockDb = {
  oAuthToken: {
    findFirst: mockFindFirst,
    update: mockUpdate,
  },
} as never;

describe('getValidToken', () => {
  beforeEach(() => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'test-client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'test-secret');
    vi.resetAllMocks();
  });

  it('throws if no token found', async () => {
    vi.resetModules();
    const { getValidToken } = await import('../get-valid-token');
    mockFindFirst.mockResolvedValue(null);

    await expect(getValidToken('microsoft', mockDb)).rejects.toThrow('No microsoft OAuth token found');
  });

  it('returns decrypted token if not expired', async () => {
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');
    const { getValidToken } = await import('../get-valid-token');

    const encrypted = encryptToken('valid-access-token');
    mockFindFirst.mockResolvedValue({
      id: 'tok-1',
      accessToken: encrypted,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      accountId: 'user-1',
    });

    const result = await getValidToken('microsoft', mockDb);
    expect(result).toBe('valid-access-token');
  });

  it('throws if token expired and no refresh token', async () => {
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');
    const { getValidToken } = await import('../get-valid-token');

    const encrypted = encryptToken('expired-token');
    mockFindFirst.mockResolvedValue({
      id: 'tok-1',
      accessToken: encrypted,
      refreshToken: null,
      expiresAt: new Date(Date.now() - 1000), // expired
      accountId: 'user-1',
    });

    await expect(getValidToken('microsoft', mockDb)).rejects.toThrow('No refresh token available');
  });

  it('refreshes token when expired and refresh token exists', async () => {
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');
    const { getValidToken } = await import('../get-valid-token');

    const encrypted = encryptToken('expired-token');
    const encryptedRefresh = encryptToken('my-refresh-token');
    mockFindFirst.mockResolvedValue({
      id: 'tok-1',
      accessToken: encrypted,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(Date.now() - 1000),
      accountId: 'user-1',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
    });
    vi.stubGlobal('fetch', mockFetch);
    mockUpdate.mockResolvedValue({});

    const result = await getValidToken('microsoft', mockDb);
    expect(result).toBe('new-access-token');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tok-1' },
      }),
    );
  });

  it('throws on 401 refresh response', async () => {
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');
    const { getValidToken } = await import('../get-valid-token');

    const encrypted = encryptToken('expired-token');
    const encryptedRefresh = encryptToken('bad-refresh');
    mockFindFirst.mockResolvedValue({
      id: 'tok-1',
      accessToken: encrypted,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(Date.now() - 1000),
      accountId: 'user-1',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      }),
    );

    await expect(getValidToken('microsoft', mockDb)).rejects.toThrow('OAuth token expired or revoked');
  });

  it('throws on 500 refresh response', async () => {
    vi.resetModules();
    const { encryptToken } = await import('../encrypt-token');
    const { getValidToken } = await import('../get-valid-token');

    const encrypted = encryptToken('expired-token');
    const encryptedRefresh = encryptToken('refresh');
    mockFindFirst.mockResolvedValue({
      id: 'tok-1',
      accessToken: encrypted,
      refreshToken: encryptedRefresh,
      expiresAt: new Date(Date.now() - 1000),
      accountId: 'user-1',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('server error'),
      }),
    );

    await expect(getValidToken('microsoft', mockDb)).rejects.toThrow('Token refresh failed with status 500');
  });
});
