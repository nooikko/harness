import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Figtree: () => ({ className: 'figtree-mock', variable: '--font-sans' }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../_components/ws-provider', () => ({
  WsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../_components/top-bar', () => ({
  TopBar: () => <nav data-testid='top-bar'>Harness</nav>,
}));

// Import after mocks are set up
const { default: RootLayout, metadata } = await import('../layout');

describe('RootLayout', () => {
  it('exports dashboard metadata with correct title', () => {
    expect(metadata.title).toBe('Harness Dashboard');
  });

  it('exports dashboard metadata with correct description', () => {
    expect(metadata.description).toBe('Orchestrator dashboard — threads, tasks, crons, and real-time monitoring');
  });

  it('renders children within an html structure', async () => {
    const element = await RootLayout({ children: <p>Hello</p> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('<html');
    expect(html).toContain('<body');
    expect(html).toContain('<p>Hello</p>');
  });

  it('applies the Figtree font variable to the body', async () => {
    const element = await RootLayout({ children: <span>content</span> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('--font-sans');
  });

  it('wraps children in a flex container', async () => {
    const element = await RootLayout({ children: <span>content</span> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('flex min-h-0 flex-1');
  });

  it('applies flex column layout to the body', async () => {
    const element = await RootLayout({ children: <span>content</span> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('flex h-screen flex-col');
  });

  it('renders the TopBar', async () => {
    const element = await RootLayout({ children: <span>content</span> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Harness');
  });
});
