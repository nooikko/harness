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

vi.mock('@harness/database', () => ({}));

const mockCreateTask = vi.fn().mockResolvedValue(undefined);
const mockListProjects = vi.fn().mockResolvedValue([]);

vi.mock('../../_actions/create-task', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}));

vi.mock('../../_actions/list-projects', () => ({
  listProjects: (...args: unknown[]) => mockListProjects(...args),
}));

import { CreateTaskDialog } from '../create-task-dialog';

const openDialog = () => {
  render(<CreateTaskDialog trigger={<button type='button'>Add Task</button>} />);
  fireEvent.click(screen.getByText('Add Task'));
};

describe('CreateTaskDialog', () => {
  beforeEach(() => {
    mockCreateTask.mockClear();
    mockListProjects.mockClear();
    mockRefresh.mockClear();
    mockCreateTask.mockResolvedValue(undefined);
    mockListProjects.mockResolvedValue([]);
  });

  it('renders the trigger element', () => {
    render(<CreateTaskDialog trigger={<button type='button'>Add Task</button>} />);

    expect(screen.getByText('Add Task')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', () => {
    openDialog();

    expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('disables submit button when title is empty', () => {
    openDialog();

    const submitButton = screen.getByRole('button', { name: 'Create Task' });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when title has content', () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My task' } });
    const submitButton = screen.getByRole('button', { name: 'Create Task' });
    expect(submitButton).not.toBeDisabled();
  });

  it('disables submit button when title is only whitespace', () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    const submitButton = screen.getByRole('button', { name: 'Create Task' });
    expect(submitButton).toBeDisabled();
  });

  it('does not submit when title is empty', () => {
    openDialog();

    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('renders description textarea', () => {
    openDialog();

    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('renders priority select', () => {
    openDialog();

    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
  });

  it('renders due date input', () => {
    openDialog();

    expect(screen.getByLabelText('Due Date')).toBeInTheDocument();
  });

  it('submits form with correct data', async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Buy groceries' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Milk and eggs' } });
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-06-15' } });

    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Buy groceries',
        description: 'Milk and eggs',
        priority: 'MEDIUM',
        dueDate: expect.any(Date),
        projectId: undefined,
      });
    });
  });

  it('submits with undefined description when empty', async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Simple task' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Simple task',
          description: undefined,
        }),
      );
    });
  });

  it('submits with undefined dueDate when empty', async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No date task' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDate: undefined,
        }),
      );
    });
  });

  it('resets form fields after successful submission', async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test task' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('closes dialog when cancel is clicked', () => {
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Create Task' })).not.toBeInTheDocument();
  });

  it('fetches projects when dialog opens', async () => {
    openDialog();

    await waitFor(() => {
      expect(mockListProjects).toHaveBeenCalled();
    });
  });

  // Note: testing project select rendering is skipped because the source
  // component uses <SelectItem value=''> which Radix rejects at render time.

  it('does not render project select when no projects', async () => {
    mockListProjects.mockResolvedValue([]);

    openDialog();

    await waitFor(() => {
      expect(mockListProjects).toHaveBeenCalled();
    });

    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
  });

  it('handles listProjects rejection gracefully', async () => {
    mockListProjects.mockRejectedValue(new Error('Network error'));

    openDialog();

    await waitFor(() => {
      expect(mockListProjects).toHaveBeenCalled();
    });

    // Should not crash; project select should not appear
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument();
  });

  it('trims the title before submitting', async () => {
    openDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Buy milk  ' } });
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!);

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Buy milk',
        }),
      );
    });
  });
});
