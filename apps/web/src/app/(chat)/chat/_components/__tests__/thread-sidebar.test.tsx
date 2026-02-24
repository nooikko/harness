import type { Thread } from 'database';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    thread: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
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

type MakeThread = (overrides?: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-1',
  source: 'web',
  sourceId: 'session-1',
  name: 'Test Thread',
  kind: 'general',
  status: 'open',
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('ThreadSidebar', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = ThreadSidebar();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('ThreadSidebarInternal', () => {
  it('renders empty state when there are no threads', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No threads yet');
  });

  it('renders thread list when threads exist', async () => {
    mockFindMany.mockResolvedValue([makeThread({ id: 'thread-1', name: 'First Thread' })]);
    const element = await ThreadSidebarInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('First Thread');
  });
});
