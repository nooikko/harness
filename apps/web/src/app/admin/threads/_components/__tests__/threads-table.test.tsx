import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../../../_actions/archive-thread', () => ({
  archiveThread: vi.fn(),
}));

vi.mock('../../../_components/relative-time', () => ({
  RelativeTime: ({ date }: { date: Date }) => <time>{date.toISOString()}</time>,
}));

vi.mock('../../../_components/row-menu', () => ({
  RowMenu: ({ actions }: { actions: Array<{ label: string }> }) => (
    <div data-testid='row-menu'>
      {actions.map((a) => (
        <span key={a.label}>{a.label}</span>
      ))}
    </div>
  ),
}));

vi.mock('../../../_components/status-dot', () => ({
  StatusDot: ({ status }: { status: string }) => <span data-testid='status-dot'>{status}</span>,
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
    expect(html).toContain('No threads yet');
  });

  it('renders table headers', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_1',
        source: 'web',
        sourceId: 'sess_1',
        name: 'Test Thread',
        kind: 'general',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: { name: 'Claude' },
        project: null,
        _count: { messages: 5 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Name');
    expect(html).toContain('Agent');
    expect(html).toContain('Source');
    expect(html).toContain('Messages');
    expect(html).toContain('Status');
  });

  it('renders table with thread data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_1',
        source: 'discord',
        sourceId: 'chan_123',
        name: 'Project Discussion',
        kind: 'general',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: { name: 'Claude' },
        project: { name: 'Main' },
        _count: { messages: 42 },
      },
      {
        id: 'thread_2',
        source: 'web',
        sourceId: 'sess_456',
        name: null,
        kind: 'task',
        status: 'closed',
        lastActivity: new Date('2026-02-23T12:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 8 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Project Discussion');
    expect(html).toContain('general');
    expect(html).toContain('active');
    expect(html).toContain('discord');
    expect(html).toContain('42');
    expect(html).toContain('Claude');
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
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 5 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/chat/thread_abc');
  });

  it('renders archive action for non-archived threads', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_open',
        source: 'web',
        sourceId: 'sess_1',
        name: 'Active Thread',
        kind: 'general',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 10 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Archive');
  });

  it('does not render archive action for archived threads', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_archived',
        source: 'discord',
        sourceId: 'chan_old',
        name: 'Old Thread',
        kind: 'general',
        status: 'archived',
        lastActivity: new Date('2026-01-01T00:00:00Z'),
        agent: null,
        project: null,
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
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 3 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('api/req_789');
  });

  it('shows dash when no agent is assigned', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_noagent',
        source: 'web',
        sourceId: 'sess_1',
        name: 'No Agent Thread',
        kind: 'general',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 1 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('\u2014');
  });

  it('renders source as a badge-like element', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_src',
        source: 'cron',
        sourceId: 'job_1',
        name: 'Cron Thread',
        kind: 'cron',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 2 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('bg-muted');
    expect(html).toContain('cron');
  });

  it('uses StatusDot for status display', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'thread_status',
        source: 'web',
        sourceId: 'sess_1',
        name: 'Status Thread',
        kind: 'general',
        status: 'active',
        lastActivity: new Date('2026-02-24T08:00:00Z'),
        agent: null,
        project: null,
        _count: { messages: 1 },
      },
    ]);
    const element = await ThreadsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="status-dot"');
  });
});
