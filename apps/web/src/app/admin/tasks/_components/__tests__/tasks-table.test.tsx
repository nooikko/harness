import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    orchestratorTask: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
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
    expect(html).toContain('No tasks found.');
  });

  it('renders table with task data', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_1',
        threadId: 'thread_1',
        parentTaskId: null,
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
        parentTaskId: null,
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
    expect(html).toContain('Analyze the codebase and generate a summary report');
    expect(html).toContain('completed');
    expect(html).toContain('2/3');
    expect(html).toContain('Code Analysis');
    expect(html).toContain('running');
    expect(html).toContain('1/5');
    expect(html).toContain('thread_2');
  });

  it('renders thread id slice when thread has no name', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_3',
        threadId: 'clxyz12345678',
        parentTaskId: null,
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

  it('renders failed status with destructive variant', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'task_4',
        threadId: 'thread_4',
        parentTaskId: null,
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
    expect(html).toContain('failed');
    expect(html).toContain('data-variant="destructive"');
  });
});
