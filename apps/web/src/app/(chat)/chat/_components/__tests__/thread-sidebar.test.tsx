import { SidebarProvider } from '@harness/ui';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    project: {
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
    expect(html).toContain('data-slot="sidebar"');
  });
});

describe('ThreadSidebarInternal', () => {
  it('renders the sidebar shell', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('data-slot="sidebar"');
  });

  it('renders the nav links section with Agents', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('Agents');
  });

  it('renders the Recents section', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('Recents');
  });

  it('renders the New chat button', async () => {
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('New chat');
  });

  it('renders project groups when projects exist', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'Test Project',
        threads: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
        instructions: null,
        memory: null,
        model: null,
      },
    ] as never);
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('Test Project');
  });
});
