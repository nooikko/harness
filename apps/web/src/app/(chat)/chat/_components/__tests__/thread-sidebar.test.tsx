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

  it('does not render project groups in sidebar', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([{ id: 'p1', name: 'Test Project' }] as never);
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).not.toContain('Test Project');
  });

  it('renders Projects section when projectsWithThreads is non-empty', async () => {
    const { prisma } = await import('@harness/database');
    // First findMany returns projects (for projectOptions)
    vi.mocked(prisma.project.findMany)
      .mockResolvedValueOnce([{ id: 'p1', name: 'Alpha' }] as never)
      // Second findMany returns projectsWithThreads
      .mockResolvedValueOnce([
        {
          id: 'p1',
          name: 'Alpha',
          updatedAt: new Date(),
          threads: [{ id: 't-1', name: 'Thread A', lastActivity: new Date() }],
        },
      ] as never);
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(<SidebarProvider>{element as React.ReactElement}</SidebarProvider>);
    expect(html).toContain('Projects');
    expect(html).toContain('Alpha');
  });
});
