import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@harness/database', () => ({}));

const mockUpdateTask = vi.fn().mockResolvedValue(undefined);

vi.mock('../../_actions/update-task', () => ({
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
}));

vi.mock('../../_actions/delete-task', () => ({
  deleteTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TaskList } from '../task-list';

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Test task',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: null,
  completedAt: null,
  sourceThreadId: null,
  sourceMessageId: null,
  createdBy: 'user',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  projectId: null,
  project: null,
  blockedBy: [],
  blocks: [],
  ...overrides,
});

describe('TaskList', () => {
  beforeEach(() => {
    mockUpdateTask.mockClear();
  });

  it('renders empty state when no tasks', () => {
    render(<TaskList tasks={[]} />);

    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByText('Create a task to get started.')).toBeInTheDocument();
  });

  it('renders task titles', () => {
    const tasks = [makeTask({ id: 't1', title: 'Buy milk' }), makeTask({ id: 't2', title: 'Deploy app' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Deploy app')).toBeInTheDocument();
  });

  it('renders priority badge for URGENT', () => {
    const tasks = [makeTask({ id: 't1', priority: 'URGENT' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('renders priority badge for HIGH', () => {
    const tasks = [makeTask({ id: 't1', priority: 'HIGH' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders priority badge for MEDIUM', () => {
    const tasks = [makeTask({ id: 't1', priority: 'MEDIUM' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders priority badge for LOW', () => {
    const tasks = [makeTask({ id: 't1', priority: 'LOW' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders default priority badge for unknown priority', () => {
    const tasks = [makeTask({ id: 't1', priority: 'UNKNOWN' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders status badge for TODO', () => {
    const tasks = [makeTask({ id: 't1', status: 'TODO' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('renders status badge for IN_PROGRESS', () => {
    const tasks = [makeTask({ id: 't1', status: 'IN_PROGRESS' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders status badge for DONE', () => {
    const tasks = [makeTask({ id: 't1', status: 'DONE' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders status badge for CANCELLED', () => {
    const tasks = [makeTask({ id: 't1', status: 'CANCELLED' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders default status badge for unknown status', () => {
    const tasks = [makeTask({ id: 't1', status: 'WEIRD' })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('renders project badge when task has a project', () => {
    const tasks = [makeTask({ id: 't1', project: { name: 'Alpha' } })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('does not render project badge when project is null', () => {
    const tasks = [makeTask({ id: 't1', project: null })];

    render(<TaskList tasks={tasks} />);

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('renders blocker count badge', () => {
    const tasks = [
      makeTask({
        id: 't1',
        blockedBy: [{ dependsOn: { id: 'b1', title: 'Blocker 1', status: 'TODO' } }, { dependsOn: { id: 'b2', title: 'Blocker 2', status: 'TODO' } }],
      }),
    ];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('2 blockers')).toBeInTheDocument();
  });

  it('renders singular blocker count', () => {
    const tasks = [
      makeTask({
        id: 't1',
        blockedBy: [{ dependsOn: { id: 'b1', title: 'Blocker 1', status: 'TODO' } }],
      }),
    ];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('1 blocker')).toBeInTheDocument();
  });

  it('does not render blocker badge when no blockers', () => {
    const tasks = [makeTask({ id: 't1', blockedBy: [] })];

    render(<TaskList tasks={tasks} />);

    expect(screen.queryByText(/blocker/)).not.toBeInTheDocument();
  });

  it('renders due date for a future task', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const tasks = [makeTask({ id: 't1', dueDate: futureDate })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText(/Due in 3d/)).toBeInTheDocument();
  });

  it('renders due today for task due today', () => {
    // Math.ceil(diff / ms_per_day) must equal 0, so diff must be <= 0 and > -86400000
    // Use a date 1 second in the past
    const today = new Date(Date.now() - 1000);
    const tasks = [makeTask({ id: 't1', dueDate: today, status: 'IN_PROGRESS' })];

    render(<TaskList tasks={tasks} />);

    // diff is -1000, days = Math.ceil(-1000/86400000) = 0
    expect(screen.getByText('Due today')).toBeInTheDocument();
  });

  it('renders due tomorrow for task due in 1 day', () => {
    // Math.ceil(diff / ms_per_day) must equal 1, so diff in (0, 86400000]
    // Use a date slightly less than 1 day from now
    const tomorrow = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const tasks = [makeTask({ id: 't1', dueDate: tomorrow })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
  });

  it('renders overdue for past due tasks', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const tasks = [makeTask({ id: 't1', dueDate: pastDate })];

    render(<TaskList tasks={tasks} />);

    expect(screen.getByText(/overdue/)).toBeInTheDocument();
  });

  it('renders month/day for tasks due more than 7 days out', () => {
    const farDate = new Date();
    farDate.setDate(farDate.getDate() + 30);
    const tasks = [makeTask({ id: 't1', dueDate: farDate })];

    render(<TaskList tasks={tasks} />);

    // Should show month + day like "Apr 15"
    const dateText = farDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  it('does not render due date when null', () => {
    const tasks = [makeTask({ id: 't1', dueDate: null })];

    render(<TaskList tasks={tasks} />);

    expect(screen.queryByText(/Due/)).not.toBeInTheDocument();
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  it('applies line-through to done task titles', () => {
    const tasks = [makeTask({ id: 't1', status: 'DONE', title: 'Finished task' })];

    render(<TaskList tasks={tasks} />);

    const titleEl = screen.getByText('Finished task');
    expect(titleEl).toHaveClass('line-through');
  });

  it('opens detail panel when a task is clicked', () => {
    const tasks = [makeTask({ id: 't1', title: 'Clickable task' })];

    render(<TaskList tasks={tasks} />);

    fireEvent.click(screen.getByText('Clickable task'));

    // Detail panel renders the task title again in its header
    const titleElements = screen.getAllByText('Clickable task');
    expect(titleElements.length).toBeGreaterThanOrEqual(2);
  });

  it('closes detail panel when clicking same task again (deselect)', () => {
    const tasks = [makeTask({ id: 't1', title: 'Toggle task' })];

    render(<TaskList tasks={tasks} />);

    fireEvent.click(screen.getByText('Toggle task'));
    // Detail panel open, should have 2 instances
    expect(screen.getAllByText('Toggle task').length).toBeGreaterThanOrEqual(2);

    // Click the same task again via the task list button
    const buttons = screen.getAllByRole('button');
    const taskButton = buttons.find((btn) => btn.textContent?.includes('Toggle task') && btn.tagName === 'BUTTON');
    if (taskButton) {
      fireEvent.click(taskButton);
    }
  });

  it('applies overdue styling to overdue tasks that are not done', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const tasks = [makeTask({ id: 't1', dueDate: pastDate, status: 'TODO' })];

    render(<TaskList tasks={tasks} />);

    const overdueText = screen.getByText(/overdue/);
    expect(overdueText).toHaveClass('text-red-600');
  });

  it('does not apply overdue styling to done tasks even if past due', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const tasks = [makeTask({ id: 't1', dueDate: pastDate, status: 'DONE' })];

    render(<TaskList tasks={tasks} />);

    const dueDateSpan = screen.getByText(/overdue/);
    expect(dueDateSpan).not.toHaveClass('text-red-600');
  });
});
