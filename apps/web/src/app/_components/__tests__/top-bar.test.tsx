import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../user-menu', () => ({
  UserMenu: ({ name }: { name: string }) => <span data-testid='user-menu'>{name}</span>,
}));

const { TopBar } = await import('../top-bar');

describe('TopBar', () => {
  it('renders Harness link', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Harness');
    expect(html).toContain('href="/"');
  });

  it('renders search button with ⌘K hint', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Search…');
    expect(html).toContain('⌘K');
  });

  it('passes profile name to UserMenu', async () => {
    mockFindUnique.mockResolvedValue({ name: 'Quinn' });
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="user-menu"');
    expect(html).toContain('Quinn');
  });

  it('falls back to "User" when no profile exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const element = await TopBar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('User');
  });
});
