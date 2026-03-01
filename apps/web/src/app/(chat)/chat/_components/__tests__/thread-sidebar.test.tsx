import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const { ThreadSidebar, ThreadSidebarInternal } = await import('../thread-sidebar');

describe('ThreadSidebar', () => {
  it('renders the sidebar', () => {
    const element = ThreadSidebar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="sidebar"');
  });
});

describe('ThreadSidebarInternal', () => {
  it('renders the sidebar shell', () => {
    const element = ThreadSidebarInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="sidebar"');
  });

  it('renders the user profile menu', () => {
    const element = ThreadSidebarInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="sidebar-footer"');
  });
});
