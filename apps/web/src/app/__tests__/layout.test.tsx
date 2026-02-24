import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-mock' }),
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

// Import after mocks are set up
const { default: RootLayout, metadata } = await import('../layout');

describe('RootLayout', () => {
  it('exports dashboard metadata with correct title', () => {
    expect(metadata.title).toBe('Harness Dashboard');
  });

  it('exports dashboard metadata with correct description', () => {
    expect(metadata.description).toBe('Orchestrator dashboard — threads, tasks, crons, and real-time monitoring');
  });

  it('renders children within an html structure', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Hello</p>
      </RootLayout>,
    );

    expect(html).toContain('<html');
    expect(html).toContain('<body');
    expect(html).toContain('<p>Hello</p>');
  });

  it('applies the Inter font className to the body', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );

    expect(html).toContain('inter-mock');
  });

  it('wraps children in a flex container', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );

    expect(html).toContain('flex min-h-0 flex-1');
  });

  it('applies flex column layout to the body', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );

    expect(html).toContain('flex h-screen flex-col');
  });

  it('renders the TopBar with navigation links', () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>,
    );

    expect(html).toContain('Harness');
    expect(html).toContain('Chat');
    expect(html).toContain('Usage');
    expect(html).toContain('Admin');
  });
});
