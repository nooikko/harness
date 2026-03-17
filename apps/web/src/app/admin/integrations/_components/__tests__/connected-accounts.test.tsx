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
    const html = renderToStaticMarkup(await ConnectedAccounts());
    expect(html).toContain('No accounts connected');
  });

  it('renders connected account with display name', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-1',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: ['Mail.Read', 'Calendars.Read'],
        metadata: { displayName: 'Quinn Penney', email: 'user@outlook.com' },
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts());
    expect(html).toContain('Quinn Penney');
    expect(html).toContain('user@outlook.com');
    expect(html).toContain('Mail.Read');
  });

  it('shows +N more badge when more than 4 scopes', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-2',
        provider: 'microsoft',
        accountId: 'user@outlook.com',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: ['a', 'b', 'c', 'd', 'e', 'f'],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts());
    expect(html).toContain('+2 more');
  });

  it('falls back to accountId when no metadata', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'tok-3',
        provider: 'microsoft',
        accountId: 'raw-account-id',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: [],
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    const html = renderToStaticMarkup(await ConnectedAccounts());
    expect(html).toContain('raw-account-id');
  });
});
