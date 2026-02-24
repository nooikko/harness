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

vi.mock('../../_actions/archive-thread', () => ({
  archiveThread: vi.fn(),
}));

const { ThreadsTable, ThreadsTableInternal } = await import('../threads-table');

describe('ThreadsTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = ThreadsTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('ThreadsTableInternal', () => {
  it('renders empty state when no threads exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No threads found.');
  });

  it('renders table with thread data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_1',
        source: 'discord',
        sourceId: 'chan_123',
        name: 'Project Discussion',
        kind: 'general',
        status: 'open',
        parentThreadId: null,
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        createdAt: new Date('2026-02-20T00:00:00Z'),
        updatedAt: new Date('2026-02-24T08:00:00Z'),
        _count: { messages: 42 },
      },
      {
        id: 'thread_2',
        source: 'web',
        sourceId: 'sess_456',
        name: null,
        kind: 'task',
        status: 'closed',
        parentThreadId: null,
        lastActivity: new Date('2026-02-23T12:00:00Z'),
        createdAt: new Date('2026-02-22T00:00:00Z'),
        updatedAt: new Date('2026-02-23T12:00:00Z'),
        _count: { messages: 8 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Project Discussion');
    expect(html).toContain('general');
    expect(html).toContain('open');
    expect(html).toContain('discord');
    expect(html).toContain('42');
    expect(html).toContain('web/sess_456');
    expect(html).toContain('task');
    expect(html).toContain('closed');
    expect(html).toContain('8');
  });

  it('renders view link to chat page', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_abc',
        source: 'discord',
        sourceId: 'chan_1',
        name: 'Test Thread',
        kind: 'general',
        status: 'open',
        parentThreadId: null,
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        createdAt: new Date('2026-02-20T00:00:00Z'),
        updatedAt: new Date('2026-02-24T08:00:00Z'),
        _count: { messages: 5 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/chat/thread_abc');
    expect(html).toContain('View');
  });

  it('renders archive button for non-archived threads', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_open',
        source: 'web',
        sourceId: 'sess_1',
        name: 'Active Thread',
        kind: 'general',
        status: 'open',
        parentThreadId: null,
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        createdAt: new Date('2026-02-20T00:00:00Z'),
        updatedAt: new Date('2026-02-24T08:00:00Z'),
        _count: { messages: 10 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Archive');
  });

  it('does not render archive button for archived threads', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_archived',
        source: 'discord',
        sourceId: 'chan_old',
        name: 'Old Thread',
        kind: 'general',
        status: 'archived',
        parentThreadId: null,
        lastActivity: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2025-12-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        _count: { messages: 100 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).not.toContain('Archive');
    expect(html).toContain('View');
  });

  it('shows source/sourceId when thread has no name', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_noname',
        source: 'api',
        sourceId: 'req_789',
        name: null,
        kind: 'general',
        status: 'open',
        parentThreadId: null,
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        createdAt: new Date('2026-02-20T00:00:00Z'),
        updatedAt: new Date('2026-02-24T08:00:00Z'),
        _count: { messages: 3 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('api/req_789');
  });
});
