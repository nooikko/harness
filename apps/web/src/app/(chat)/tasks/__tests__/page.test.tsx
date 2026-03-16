import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../_components/create-task-dialog', () => ({
  CreateTaskDialog: ({ trigger }: { trigger: React.ReactNode }) => <div data-testid='create-task-dialog'>{trigger}</div>,
}));

vi.mock('../_components/task-filters', () => ({
  TaskFilters: () => <div data-testid='task-filters' />,
}));

vi.mock('../_components/task-list', () => ({
  TaskList: () => <div data-testid='task-list' />,
}));

vi.mock('../_actions/list-tasks', () => ({
  listTasks: vi.fn().mockResolvedValue([]),
}));

const { default: TasksPage } = await import('../page');

describe('TasksPage', () => {
  const defaultProps = {
    searchParams: Promise.resolve({}),
  };

  it('renders page heading with Tasks', async () => {
    const element = await TasksPage(defaultProps);
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('Tasks');
    expect(html).toContain('<h1');
  });

  it('renders CreateTaskDialog trigger', async () => {
    const element = await TasksPage(defaultProps);
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('create-task-dialog');
    expect(html).toContain('New Task');
  });

  it('renders TaskFilters component', async () => {
    const element = await TasksPage(defaultProps);
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('task-filters');
  });
});
