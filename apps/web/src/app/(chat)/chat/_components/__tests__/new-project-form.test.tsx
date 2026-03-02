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

const mockCreateProject = vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test' });

vi.mock('../../_actions/create-project', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

import { NewProjectForm } from '../new-project-form';

const openDialog = async () => {
  render(<NewProjectForm />);
  fireEvent.click(screen.getByRole('button', { name: /new project/i }));
  await waitFor(() => screen.getByRole('dialog'));
};

describe('NewProjectForm', () => {
  beforeEach(() => {
    mockCreateProject.mockClear();
    mockRefresh.mockClear();
    mockCreateProject.mockResolvedValue({ id: 'proj-1', name: 'Test' });
  });

  it('renders the trigger button', () => {
    render(<NewProjectForm />);
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
  });

  it('opens the dialog when trigger is clicked', async () => {
    await openDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders name, description, and instructions fields when open', async () => {
    await openDialog();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/instructions/i)).toBeInTheDocument();
  });

  it('submit button is disabled when name is empty', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /create project/i })).toBeDisabled();
  });

  it('submit button is enabled when name is filled', async () => {
    await openDialog();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'My Project' } });
    expect(screen.getByRole('button', { name: /create project/i })).not.toBeDisabled();
  });

  it('renders Cancel button when dialog is open', async () => {
    await openDialog();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('closes the dialog when Cancel is clicked', async () => {
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('calls createProject with name, description, and instructions on submit', async () => {
    await openDialog();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Alpha' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'A desc' } });
    fireEvent.change(screen.getByLabelText(/instructions/i), { target: { value: 'Be helpful' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'Alpha',
        description: 'A desc',
        instructions: 'Be helpful',
      });
    });
  });

  it('calls createProject with only name when optional fields are empty', async () => {
    await openDialog();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Solo' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'Solo',
        description: undefined,
        instructions: undefined,
      });
    });
  });

  it('closes dialog after successful creation', async () => {
    await openDialog();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Proj' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows error message when createProject throws', async () => {
    mockCreateProject.mockRejectedValueOnce(new Error('Server error'));
    await openDialog();
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Fail' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
