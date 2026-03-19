import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockDelete = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockGet, delete: mockDelete }),
}));

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

const mockHandleOAuthCallback = vi.fn();
vi.mock('@harness/oauth', () => ({
  handleOAuthCallback: mockHandleOAuthCallback,
  isProviderSupported: (p: string) => p === 'microsoft' || p === 'google',
}));

vi.mock('@harness/database', () => ({
  prisma: { mockPrisma: true },
}));

const { GET } = await import('../route');

const makeRequest = (params: Record<string, string>) => {
  const url = new URL('http://localhost:3000/api/oauth/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return { nextUrl: url } as Parameters<typeof GET>[0];
};

describe('GET /api/oauth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return oauth_state for 'oauth_state', undefined for others
    mockGet.mockImplementation((name: string) => {
      if (name === 'oauth_state') return { value: 'valid-state' };
      if (name === 'oauth_provider') return { value: 'microsoft' };
      return undefined;
    });
  });

  it('redirects with error message for known OAuth errors', async () => {
    await GET(makeRequest({ error: 'access_denied' }));
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('Access+was+denied'));
  });

  it('redirects with generic message for unknown OAuth errors', async () => {
    await GET(makeRequest({ error: 'unknown_error' }));
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('Authentication+failed'));
  });

  it('redirects on state mismatch', async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === 'oauth_state') return { value: 'stored-state' };
      if (name === 'oauth_provider') return { value: 'microsoft' };
      return undefined;
    });
    await GET(makeRequest({ code: 'auth-code', state: 'wrong-state' }));
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('Invalid+state+parameter'));
  });

  it('redirects when no code is provided', async () => {
    await GET(makeRequest({ state: 'valid-state' }));
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('No+authorization+code+received'));
  });

  it('calls handleOAuthCallback and redirects on success', async () => {
    mockHandleOAuthCallback.mockResolvedValue(undefined);

    await GET(makeRequest({ code: 'auth-code', state: 'valid-state' }));

    expect(mockHandleOAuthCallback).toHaveBeenCalledWith({
      code: 'auth-code',
      provider: 'microsoft',
      db: { mockPrisma: true },
    });
    expect(mockRedirect).toHaveBeenCalledWith('/admin/integrations?success=true');
  });

  it('redirects with error when handleOAuthCallback throws', async () => {
    mockHandleOAuthCallback.mockRejectedValue(new Error('Token exchange failed'));

    await GET(makeRequest({ code: 'auth-code', state: 'valid-state' }));

    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('Token+exchange+failed'));
  });

  it('deletes oauth_state and oauth_provider cookies', async () => {
    mockHandleOAuthCallback.mockResolvedValue(undefined);

    await GET(makeRequest({ code: 'auth-code', state: 'valid-state' }));

    expect(mockDelete).toHaveBeenCalledWith('oauth_state');
    expect(mockDelete).toHaveBeenCalledWith('oauth_provider');
  });
});
