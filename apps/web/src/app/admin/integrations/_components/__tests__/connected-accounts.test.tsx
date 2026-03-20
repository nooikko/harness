import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
vi.mock('@harness/database', () => ({
  prisma: {
    oAuthToken: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock('../disconnect-button', () => ({
  DisconnectButton: ({ provider, accountId }: { provider: string; accountId: string }) => (
    <button type='button' data-testid={`disconnect-${accountId}`}>
      Disconnect {provider}
    </button>
  ),
}));

const { ConnectedAccounts } = await import('../connected-accounts');

describe('ConnectedAccounts', () => {
  it('renders empty state when no tokens exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('No accounts connected');
  });

  it('renders connected account with display name', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-1',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() + 3600_000),
        refreshToken: 'encrypted-refresh',
        scopes: ['Mail.Read', 'Calendars.Read'],
        metadata: { displayName: 'Quinn Penney', email: 'user@outlook.com' },
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('Quinn Penney');
    expect(html).toContain('user@outlook.com');
  });

  it('falls back to accountId when metadata is null', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-2',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() + 3600_000),
        refreshToken: 'encrypted-refresh',
        scopes: ['a', 'b', 'c', 'd', 'e', 'f'],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('user@outlook.com');
  });

  it('falls back to accountId when no metadata', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-3',
        provider: 'microsoft',
        accountId: 'raw-account-id',
        expiresAt: new Date(Date.now() + 3600_000),
        refreshToken: 'encrypted-refresh',
        scopes: [],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('raw-account-id');
  });

  it('shows "Connected" with green dot when token is valid', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-4',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() + 3600_000),
        refreshToken: 'encrypted-refresh',
        scopes: [],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('Connected');
    expect(html).toContain('bg-green-500');
  });

  it('shows "Connected" when token expired but refresh token exists', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-5',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() - 3600_000), // expired 1 hour ago
        refreshToken: 'encrypted-refresh',
        scopes: [],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('Connected');
    expect(html).toContain('bg-green-500');
    expect(html).not.toContain('Re-authentication required');
  });

  it('shows "Re-authentication required" when expired with no refresh token', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-6',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() - 3600_000), // expired 1 hour ago
        refreshToken: null,
        scopes: [],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts({}));
    expect(html).toContain('Re-authentication required');
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('>Connected<');
  });
});
