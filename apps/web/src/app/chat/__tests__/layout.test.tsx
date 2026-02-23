import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('database', () => ({
  prisma: {
    thread: {
      findMany: () => Promise.resolve([]),
    },
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

const { default: ChatLayout, metadata } = await import('../layout');

describe('ChatLayout', () => {
  it('exports correct metadata title', () => {
    expect(metadata.title).toBe('Chat | Harness Dashboard');
  });

  it('exports correct metadata description', () => {
    expect(metadata.description).toBe('Multi-thread chat interface for the Harness orchestrator');
  });

  it('renders children within the layout structure', async () => {
    const element = await ChatLayout({ children: <p>Test child</p> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('<p>Test child</p>');
  });

  it('renders the thread sidebar', async () => {
    const element = await ChatLayout({ children: <p>Content</p> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Threads');
  });

  it('renders a main content area', async () => {
    const element = await ChatLayout({ children: <p>Main content</p> });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('<main');
    expect(html).toContain('Main content');
  });
});
