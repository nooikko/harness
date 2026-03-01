import { SidebarProvider } from '@harness/ui';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

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
  it('renders the sidebar with Suspense boundary', () => {
    const element = ThreadSidebar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    // Suspense renders the fallback synchronously in static markup
    expect(html).toContain('data-slot="sidebar"');
  });
});

describe('ThreadSidebarInternal', () => {
  it('renders the sidebar shell', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('data-slot="sidebar"');
  });

  it('renders the nav products section', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('Products');
  });
});
