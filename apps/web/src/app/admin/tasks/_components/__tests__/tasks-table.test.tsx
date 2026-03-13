import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    orchestratorTask: {
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

const { TasksTable, TasksTableInternal } = await import('../tasks-table');

describe('TasksTable', () => {
  it('renders a Suspense fallback skeleton', () => {
    const element = TasksTable();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="skeleton"');
  });
});

describe('TasksTableInternal', () => {
  it('renders empty state when no tasks exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No delegation tasks yet');
  });

  it('renders table with task data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_1',
        threadId: 'thread_1',
        status: 'completed',
        prompt: 'Analyze the codebase and generate a summary report',
        result: 'Summary generated',
        maxIterations: 3,
        currentIteration: 2,
        thread: { id: 'thread_1', name: 'Code Analysis' },
        createdAt: new Date('2026-02-23T10:00:00Z'),
        updatedAt: new Date('2026-02-23T10:05:00Z'),
      },
      {
        id: 'task_2',
        threadId: 'thread_2',
        status: 'running',
        prompt: 'Deploy latest changes to staging',
        result: null,
        maxIterations: 5,
        currentIteration: 1,
        thread: { id: 'thread_2', name: null },
        createdAt: new Date('2026-02-24T08:00:00Z'),
        updatedAt: new Date('2026-02-24T08:01:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Analyze the codebase and generate a summary report');
    expect(html).toContain('completed');
    expect(html).toContain('2/3');
    expect(html).toContain('Code Analysis');
    expect(html).toContain('running');
    expect(html).toContain('1/5');
    expect(html).toContain('thread_2');
  });

  it('renders progress bar with correct value', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_prog',
        threadId: 'thread_prog',
        status: 'running',
        prompt: 'Progress test',
        result: null,
        maxIterations: 4,
        currentIteration: 2,
        thread: { id: 'thread_prog', name: 'Progress' },
        createdAt: new Date('2026-02-24T10:00:00Z'),
        updatedAt: new Date('2026-02-24T10:05:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('2/4');
  });

  it('renders thread id slice when thread has no name', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_3',
        threadId: 'clxyz12345678',
        status: 'pending',
        prompt: 'Test task',
        result: null,
        maxIterations: 3,
        currentIteration: 0,
        thread: { id: 'clxyz12345678', name: null },
        createdAt: new Date('2026-02-24T09:00:00Z'),
        updatedAt: new Date('2026-02-24T09:00:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('clxyz123');
  });

  it('uses StatusDot for status display', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_4',
        threadId: 'thread_4',
        status: 'failed',
        prompt: 'Failed task',
        result: null,
        maxIterations: 3,
        currentIteration: 3,
        thread: { id: 'thread_4', name: 'Failing Thread' },
        createdAt: new Date('2026-02-24T09:00:00Z'),
        updatedAt: new Date('2026-02-24T09:00:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-testid="status-dot"');
    expect(html).toContain('data-status="failed"');
  });

  it('renders running task with pulse', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_pulse',
        threadId: 'thread_pulse',
        status: 'running',
        prompt: 'Running task',
        result: null,
        maxIterations: 3,
        currentIteration: 1,
        thread: { id: 'thread_pulse', name: 'Running' },
        createdAt: new Date('2026-02-24T10:00:00Z'),
        updatedAt: new Date('2026-02-24T10:00:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('data-pulse="true"');
  });

  it('truncates long prompts with ellipsis', async () => {
    const longPrompt = 'A'.repeat(120);
    mockFindMany.mockResolvedValue([
      {
        id: 'task_long',
        threadId: 'thread_long',
        status: 'pending',
        prompt: longPrompt,
        result: null,
        maxIterations: 3,
        currentIteration: 0,
        thread: { id: 'thread_long', name: 'Long Prompt' },
        createdAt: new Date('2026-02-24T10:00:00Z'),
        updatedAt: new Date('2026-02-24T10:00:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('A'.repeat(80));
    expect(html).toContain('\u2026');
    expect(html).not.toContain('A'.repeat(81));
  });

  it('renders thread link to chat page', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_link',
        threadId: 'thread_link',
        status: 'completed',
        prompt: 'Test task',
        result: 'Done',
        maxIterations: 1,
        currentIteration: 1,
        thread: { id: 'thread_link', name: 'Linked Thread' },
        createdAt: new Date('2026-02-24T10:00:00Z'),
        updatedAt: new Date('2026-02-24T10:00:00Z'),
      },
    ]);
    const element = await TasksTableInternal();
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('/chat/thread_link');
  });
});
