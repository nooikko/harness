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
    expect(html).toContain('No agent runs found.');
  });

  it('renders table with agent run data', async () => {
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
    expect(html).toContain('claude-opus-4-6');
    expect(html).toContain('completed');
    expect(html).toContain('12,500');
    expect(html).toContain('3,200');
    expect(html).toContain('$0.1875');
    expect(html).toContain('Code Review');
    expect(html).toContain('claude-sonnet-4-6');
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

  it('renders failed status with destructive variant', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'run_4',
        threadId: 'thread_4',
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
        thread: { id: 'thread_4', name: 'Failed Run' },
      },
    ]);
    const element = await AgentRunsTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('failed');
    expect(html).toContain('data-variant="destructive"');
  });
});
