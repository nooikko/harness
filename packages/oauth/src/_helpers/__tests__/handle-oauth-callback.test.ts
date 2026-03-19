import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpsert = vi.fn();
const mockDb = {
  oAuthToken: {
    upsert: mockUpsert,
  },
} as never;

describe('handleOAuthCallback', () => {
  beforeEach(() => {
    vi.stubEnv('OAUTH_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'test-client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'test-secret');
    vi.stubEnv('MICROSOFT_TENANT_ID', 'test-tenant');
    vi.stubEnv('MICROSOFT_REDIRECT_URI', 'http://localhost:3000/api/oauth/callback');
    vi.resetAllMocks();
  });

  it('exchanges code for tokens and stores in DB', async () => {
    vi.resetModules();

    const mockFetch = vi
      .fn()
      // First call: token exchange
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            scope: 'Mail.Read Calendars.Read',
          }),
      })
      // Second call: profile
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'user-123',
            mail: 'test@example.com',
            displayName: 'Test User',
          }),
      });

    vi.stubGlobal('fetch', mockFetch);
    mockUpsert.mockResolvedValue({});

    const { handleOAuthCallback } = await import('../handle-oauth-callback');

    const result = await handleOAuthCallback({
      code: 'auth-code-123',
      provider: 'microsoft',
      db: mockDb,
    });

    expect(result.accountId).toBe('user-123');
    expect(result.email).toBe('test@example.com');
    expect(mockUpsert).toHaveBeenCalledOnce();

    const upsertCall = mockUpsert.mock.calls[0]![0] as {
      where: {
        provider_accountId: { provider: string; accountId: string };
      };
    };
    expect(upsertCall.where.provider_accountId.provider).toBe('microsoft');
    expect(upsertCall.where.provider_accountId.accountId).toBe('user-123');
  });

  it('throws on token exchange failure', async () => {
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      }),
    );

    const { handleOAuthCallback } = await import('../handle-oauth-callback');

    await expect(
      handleOAuthCallback({
        code: 'bad-code',
        provider: 'microsoft',
        db: mockDb,
      }),
    ).rejects.toThrow('Token exchange failed');
  });

  it('throws on profile fetch failure', async () => {
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              expires_in: 3600,
              scope: 'Mail.Read',
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
        }),
    );

    const { handleOAuthCallback } = await import('../handle-oauth-callback');

    await expect(handleOAuthCallback({ code: 'code', provider: 'microsoft', db: mockDb })).rejects.toThrow('Failed to fetch user profile: 403');
  });

  it('falls back to userPrincipalName when mail is absent', async () => {
    vi.resetModules();

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'tok',
              expires_in: 3600,
              scope: 'Mail.Read',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'user-456',
              userPrincipalName: 'upn@example.com',
              displayName: 'UPN User',
            }),
        }),
    );
    mockUpsert.mockResolvedValue({});

    const { handleOAuthCallback } = await import('../handle-oauth-callback');
    const result = await handleOAuthCallback({ code: 'code', provider: 'microsoft', db: mockDb });
    expect(result.email).toBe('upn@example.com');
  });

  it('throws for unsupported provider', async () => {
    vi.resetModules();
    const { handleOAuthCallback } = await import('../handle-oauth-callback');

    await expect(
      handleOAuthCallback({
        code: 'code',
        provider: 'github',
        db: mockDb,
      }),
    ).rejects.toThrow('Unsupported OAuth provider: github');
  });
});
