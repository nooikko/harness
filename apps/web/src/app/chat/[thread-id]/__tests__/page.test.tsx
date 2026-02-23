import type { Message, Thread } from 'database';
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

const { default: ThreadPage } = await import('../page');

type MakeThread = (overrides?: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-abc',
  source: 'web',
  sourceId: 'session-1',
  name: 'My Thread',
  kind: 'general',
  status: 'open',
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

type MakeMessage = (overrides?: Partial<Message>) => Message;

const makeMessage: MakeMessage = (overrides) => ({
  id: 'msg-1',
  threadId: 'thread-abc',
  role: 'user',
  content: 'Test message',
  metadata: null,
  createdAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('ThreadPage', () => {
  it('renders thread name in the header', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ name: 'Research Thread' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({ params: Promise.resolve({ 'thread-id': 'thread-abc' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Research Thread');
  });

  it('renders messages for the thread', async () => {
    mockFindUnique.mockResolvedValue(makeThread());
    mockFindMany.mockResolvedValue([
      makeMessage({ id: 'm1', content: 'Hello there' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'Hi! How can I help?' }),
    ]);

    const element = await ThreadPage({ params: Promise.resolve({ 'thread-id': 'thread-abc' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('Hello there');
    expect(html).toContain('Hi! How can I help?');
  });

  it('displays thread kind and status', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ kind: 'task', status: 'open' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({ params: Promise.resolve({ 'thread-id': 'thread-abc' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('task thread');
    expect(html).toContain('open');
  });

  it('calls notFound when thread does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(ThreadPage({ params: Promise.resolve({ 'thread-id': 'nonexistent' }) })).rejects.toThrow('NOT_FOUND');
  });

  it('displays source/sourceId when name is null', async () => {
    mockFindUnique.mockResolvedValue(makeThread({ name: null, source: 'discord', sourceId: 'ch-456' }));
    mockFindMany.mockResolvedValue([]);

    const element = await ThreadPage({ params: Promise.resolve({ 'thread-id': 'thread-abc' }) });
    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(html).toContain('discord/ch-456');
  });
});
