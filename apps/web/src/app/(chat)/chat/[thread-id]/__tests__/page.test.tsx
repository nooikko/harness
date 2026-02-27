import type { Thread } from 'database';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    thread: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    message: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

vi.mock('../../_components/chat-area', () => ({
  ChatArea: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../_components/chat-input', () => ({
  ChatInput: () => null,
}));

vi.mock('../../_components/prewarm-trigger', () => ({
  PrewarmTrigger: () => null,
}));

const { default: ThreadPage } = await import('../page');

type MakeThread = (overrides?: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-abc',
  source: 'web',
  sourceId: 'session-1',
  name: 'My Thread',
  kind: 'general',
  status: 'open',
  sessionId: null,
  model: null,
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

type MakeParams = (threadId: string) => Promise<{ 'thread-id': string }>;

const makeParams: MakeParams = (threadId) => Promise.resolve({ 'thread-id': threadId });

describe('ThreadPage', () => {
  it('renders thread name in the header', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ name: 'Research Thread' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({
      params: makeParams('thread-abc'),
    });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Research Thread');
  });

  it('renders Suspense fallback with skeleton placeholders', async () => {
    mockFindUnique.mockResolvedValue(makeThread());

    const element = await ThreadPage({
      params: makeParams('thread-abc'),
    });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('data-slot="skeleton"');
  });

  it('displays thread kind and status', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ kind: 'task', status: 'open' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({
      params: makeParams('thread-abc'),
    });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('task thread');
    expect(html).toContain('open');
  });

  it('calls notFound when thread does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(ThreadPage({ params: makeParams('nonexistent') })).rejects.toThrow('NOT_FOUND');
  });

  it('displays source/sourceId when name is null', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ name: null, source: 'discord', sourceId: 'ch-456' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({
      params: makeParams('thread-abc'),
    });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('discord/ch-456');
  });

  it('renders successfully when thread has a model set', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ model: 'claude-opus-4-6' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({
      params: makeParams('thread-abc'),
    });
    const html = renderToStaticMarkup(element as React.ReactElement);

    // model selector lives inside ChatInput (inside ChatArea), not in the page header
    expect(html).toContain('My Thread');
  });
});
