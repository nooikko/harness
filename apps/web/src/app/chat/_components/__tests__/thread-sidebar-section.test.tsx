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

const { ThreadSidebarSection, ThreadSidebarSkeleton } = await import('../thread-sidebar-section');

describe('ThreadSidebarSection', () => {
  it('renders the thread sidebar with fetched data', async () => {
    const element = await ThreadSidebarSection();
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Threads');
  });
});

describe('ThreadSidebarSkeleton', () => {
  it('renders sidebar skeleton placeholders', () => {
    const html = renderToStaticMarkup((<ThreadSidebarSkeleton />) as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});
