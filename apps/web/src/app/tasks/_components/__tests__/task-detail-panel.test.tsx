import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@harness/database', () => ({}));

// Mock Radix Select to render a native <select> for testability
vi.mock('@harness/ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => (
      <select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid='mock-select'>
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  };
});

const mockUpdateTask = vi.fn().mockResolvedValue(undefined);
const mockDeleteTask = vi.fn().mockResolvedValue(undefined);

vi.mock('../../_actions/update-task', () => ({
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
}));

vi.mock('../../_actions/delete-task', () => ({
  deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
}));

import { TaskDetailPanel } from '../task-detail-panel';

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Test task',
  description: 'A description',
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

describe('TaskDetailPanel', () => {
  beforeEach(() => {
    mockUpdateTask.mockClear();
    mockDeleteTask.mockClear();
    mockRefresh.mockClear();
    mockUpdateTask.mockResolvedValue(undefined);
    mockDeleteTask.mockResolvedValue(undefined);
  });

  it('renders task title and description', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('does not render description when it is null', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ description: null })} onClose={onClose} />);

    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.queryByText('A description')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    // The close button is the X icon button at top right
    const closeButtons = screen.getAllByRole('button');
    const closeBtn = closeButtons[0]!; // first button is the close X
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('renders status select with current value', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ status: 'IN_PROGRESS' })} onClose={onClose} />);

    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders priority select with current value', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ priority: 'HIGH' })} onClose={onClose} />);

    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    const onClose = vi.fn();
    const dueDate = new Date('2026-06-15');
    const expected = new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    render(<TaskDetailPanel task={makeTask({ dueDate })} onClose={onClose} />);

    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('does not render due date section when null', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ dueDate: null })} onClose={onClose} />);

    expect(screen.queryByText('Due Date')).not.toBeInTheDocument();
  });

  it('renders completed date when present', () => {
    const onClose = vi.fn();
    const completedAt = new Date('2026-03-10');
    const expected = new Date(completedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    render(<TaskDetailPanel task={makeTask({ completedAt })} onClose={onClose} />);

    expect(screen.getByText('Completed At')).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('does not render completed date when null', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ completedAt: null })} onClose={onClose} />);

    expect(screen.queryByText('Completed At')).not.toBeInTheDocument();
  });

  it('renders project name when present', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ project: { name: 'Alpha' } })} onClose={onClose} />);

    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('does not render project section when null', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ project: null })} onClose={onClose} />);

    expect(screen.queryByText('Project')).not.toBeInTheDocument();
  });

  it('renders source thread link when sourceThreadId exists', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ sourceThreadId: 'thread-abc' })} onClose={onClose} />);

    expect(screen.getByText('Source Thread')).toBeInTheDocument();
    expect(screen.getByText('View conversation')).toBeInTheDocument();
    const link = screen.getByText('View conversation').closest('a');
    expect(link).toHaveAttribute('href', '/chat/thread-abc');
  });

  it('does not render source thread when null', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask({ sourceThreadId: null })} onClose={onClose} />);

    expect(screen.queryByText('Source Thread')).not.toBeInTheDocument();
  });

  it('shows delete confirmation when delete button is clicked', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Delete Task'));

    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument();
  });

  it('hides delete confirmation when cancel is clicked', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Delete Task'));
    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Are you sure? This cannot be undone.')).not.toBeInTheDocument();
  });

  it('calls deleteTask and onClose when delete is confirmed', async () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Delete Task'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('renders blocker and blocks sections when present', () => {
    const task = makeTask({
      blockedBy: [{ dependsOn: { id: 't2', title: 'Blocker task', status: 'TODO' } }],
      blocks: [{ dependent: { id: 't3', title: 'Downstream task', status: 'IN_PROGRESS' } }],
    });
    const onClose = vi.fn();

    render(<TaskDetailPanel task={task} onClose={onClose} />);

    expect(screen.getByText('Blocked by')).toBeInTheDocument();
    expect(screen.getByText('Blocker task')).toBeInTheDocument();
    expect(screen.getByText('Blocks')).toBeInTheDocument();
    expect(screen.getByText('Downstream task')).toBeInTheDocument();
  });

  it('does not render dependency sections when both are empty', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    expect(screen.queryByText('Blocked by')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocks')).not.toBeInTheDocument();
  });

  it('renders only blockedBy section when blocks is empty', () => {
    const task = makeTask({
      blockedBy: [{ dependsOn: { id: 't2', title: 'Blocker task', status: 'TODO' } }],
      blocks: [],
    });
    const onClose = vi.fn();

    render(<TaskDetailPanel task={task} onClose={onClose} />);

    expect(screen.getByText('Blocked by')).toBeInTheDocument();
    expect(screen.queryByText('Blocks')).not.toBeInTheDocument();
  });

  it('renders only blocks section when blockedBy is empty', () => {
    const task = makeTask({
      blockedBy: [],
      blocks: [{ dependent: { id: 't3', title: 'Downstream', status: 'TODO' } }],
    });
    const onClose = vi.fn();

    render(<TaskDetailPanel task={task} onClose={onClose} />);

    expect(screen.queryByText('Blocked by')).not.toBeInTheDocument();
    expect(screen.getByText('Blocks')).toBeInTheDocument();
  });

  it('renders done blocker with line-through style', () => {
    const task = makeTask({
      blockedBy: [{ dependsOn: { id: 't2', title: 'Done blocker', status: 'DONE' } }],
    });
    const onClose = vi.fn();

    render(<TaskDetailPanel task={task} onClose={onClose} />);

    const blockerText = screen.getByText('Done blocker');
    expect(blockerText).toHaveClass('line-through');
  });

  it('calls updateTask when status is changed', async () => {
    const onClose = vi.fn();
    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    const selects = screen.getAllByTestId('mock-select');
    // First select is status, second is priority
    fireEvent.change(selects[0]!, { target: { value: 'IN_PROGRESS' } });

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith({ id: 'task-1', status: 'IN_PROGRESS' });
    });
  });

  it('calls updateTask when priority is changed', async () => {
    const onClose = vi.fn();
    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    const selects = screen.getAllByTestId('mock-select');
    fireEvent.change(selects[1]!, { target: { value: 'HIGH' } });

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith({ id: 'task-1', priority: 'HIGH' });
    });
  });

  it('renders created date', () => {
    const onClose = vi.fn();

    render(<TaskDetailPanel task={makeTask()} onClose={onClose} />);

    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('renders blocker with unknown status using default icon', () => {
    const task = makeTask({
      blockedBy: [{ dependsOn: { id: 't2', title: 'Unknown status', status: 'WEIRD_STATUS' } }],
    });
    const onClose = vi.fn();

    render(<TaskDetailPanel task={task} onClose={onClose} />);

    expect(screen.getByText('Unknown status')).toBeInTheDocument();
  });
});
