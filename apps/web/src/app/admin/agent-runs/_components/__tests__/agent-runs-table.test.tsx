import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agentRun: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('../../../_components/relative-time', () => ({
  RelativeTime: ({ date }: { date: Date }) => <time>{date.toISOString()}</time>,
}));

vi.mock('../../../_components/status-dot', () => ({
  StatusDot: ({ status, pulse }: { status: string; pulse?: boolean }) => (
    <span data-testid='status-dot' data-status={status} data-pulse={pulse}>
      {status}
    </span>
  ),
}));

vi.mock('../../../_helpers/humanize-model-name', () => ({
  humanizeModelName: (id: string) => {
    const map: Record<string, string> = {
      'claude-opus-4-6': 'Opus 4.6',
      'claude-sonnet-4-6': 'Sonnet 4.6',
      'claude-haiku-4': 'Haiku 4',
    };
    return map[id] ?? id;
  },
}));

const { AgentRunsTable, AgentRunsTableInternal } = await import('../agent-runs-table');

describe('AgentRunsTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = AgentRunsTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('AgentRunsTableInternal', () => {
  it('renders empty state when no runs exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No agent runs yet');
  });

  it('renders table with agent run data and human model names', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_1',
        threadId: 'thread_1',
        taskId: 'task_1',
        model: 'claude-opus-4-6',
        inputTokens: 12500,
        outputTokens: 3200,
        costEstimate: 0.1875,
        durationMs: 4500,
        status: 'completed',
        error: null,
        startedAt: new Date('2026-02-23T10:00:00Z'),
        completedAt: new Date('2026-02-23T10:00:04Z'),
        thread: { id: 'thread_1', name: 'Code Review' },
      },
      {
        id: 'run_2',
        threadId: 'thread_2',
        taskId: null,
        model: 'claude-sonnet-4-6',
        inputTokens: 5000,
        outputTokens: 1000,
        costEstimate: 0.0045,
        durationMs: 2000,
        status: 'running',
        error: null,
        startedAt: new Date('2026-02-24T08:00:00Z'),
        completedAt: null,
        thread: { id: 'thread_2', name: null },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Opus 4.6');
    expect(html).toContain('completed');
    expect(html).toContain('12,500');
    expect(html).toContain('3,200');
    expect(html).toContain('$0.1875');
    expect(html).toContain('Code Review');
    expect(html).toContain('Sonnet 4.6');
    expect(html).toContain('running');
    expect(html).toContain('thread_2');
  });

  it('renders cost with 4 decimal places', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_3',
        threadId: 'thread_3',
        taskId: null,
        model: 'claude-haiku-4',
        inputTokens: 100,
        outputTokens: 50,
        costEstimate: 0.0001,
        durationMs: 500,
        status: 'completed',
        error: null,
        startedAt: new Date('2026-02-24T09:00:00Z'),
        completedAt: new Date('2026-02-24T09:00:00Z'),
        thread: { id: 'thread_3', name: 'Quick Task' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('$0.0001');
  });

  it('renders duration as seconds', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_dur',
        threadId: 'thread_dur',
        taskId: null,
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        costEstimate: 0.01,
        durationMs: 10500,
        status: 'completed',
        error: null,
        startedAt: new Date('2026-02-24T09:00:00Z'),
        completedAt: new Date('2026-02-24T09:00:10Z'),
        thread: { id: 'thread_dur', name: 'Duration Test' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('10.0s');
  });

  it('shows dash for duration when run is in progress', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_running',
        threadId: 'thread_r',
        taskId: null,
        model: 'claude-opus-4-6',
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: 0,
        durationMs: 0,
        status: 'running',
        error: null,
        startedAt: new Date('2026-02-24T09:00:00Z'),
        completedAt: null,
        thread: { id: 'thread_r', name: 'Running' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('\u2014');
    expect(html).toContain('data-pulse="true"');
  });

  it('uses StatusDot for status display', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_status',
        threadId: 'thread_s',
        taskId: null,
        model: 'claude-opus-4-6',
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: 0,
        durationMs: 100,
        status: 'failed',
        error: 'Connection timeout',
        startedAt: new Date('2026-02-24T09:00:00Z'),
        completedAt: null,
        thread: { id: 'thread_s', name: 'Failed Run' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="status-dot"');
    expect(html).toContain('data-status="failed"');
  });

  it('renders thread link to chat page', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_link',
        threadId: 'thread_link',
        taskId: null,
        model: 'claude-opus-4-6',
        inputTokens: 100,
        outputTokens: 50,
        costEstimate: 0.01,
        durationMs: 1000,
        status: 'completed',
        error: null,
        startedAt: new Date('2026-02-24T09:00:00Z'),
        completedAt: new Date('2026-02-24T09:00:01Z'),
        thread: { id: 'thread_link', name: 'Linked Thread' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/chat/thread_link');
    expect(html).toContain('Linked Thread');
  });
});
