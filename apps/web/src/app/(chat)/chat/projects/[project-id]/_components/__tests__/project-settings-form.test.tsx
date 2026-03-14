import type { Project } from '@harness/database';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock('@harness/database', () => ({}));

const mockUpdateProject = vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Updated' });
const mockDeleteProject = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../_actions/update-project', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

vi.mock('../../../../_actions/delete-project', () => ({
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}));

// The component uses "../../../_actions/..." relative to _components/
vi.mock('../../../_actions/update-project', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

vi.mock('../../../_actions/delete-project', () => ({
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}));

vi.mock('../../../_actions/rewrite-with-ai', () => ({
  rewriteWithAi: vi.fn().mockResolvedValue('Rewritten text'),
}));

import { ProjectSettingsForm } from '../project-settings-form';

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'proj-1',
  name: 'Alpha Project',
  description: 'A description',
  instructions: 'Some instructions',
  memory: null,
  model: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('ProjectSettingsForm', () => {
  beforeEach(() => {
    mockUpdateProject.mockClear();
    mockDeleteProject.mockClear();
    mockPush.mockClear();
    mockRefresh.mockClear();
    mockUpdateProject.mockResolvedValue({ id: 'proj-1', name: 'Updated' });
    mockDeleteProject.mockResolvedValue(undefined);
  });

  it('renders the name field pre-populated', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Alpha Project');
  });

  it('renders the description field pre-populated', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    expect(screen.getByLabelText(/description/i)).toHaveValue('A description');
  });

  it('renders the instructions field pre-populated', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    expect(screen.getByLabelText(/instructions/i)).toHaveValue('Some instructions');
  });

  it('renders with empty description when project has none', () => {
    render(<ProjectSettingsForm project={makeProject({ description: null })} />);
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  it('renders with empty instructions when project has none', () => {
    render(<ProjectSettingsForm project={makeProject({ instructions: null })} />);
    expect(screen.getByLabelText(/instructions/i)).toHaveValue('');
  });

  it('renders Save Changes button', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('renders Delete Project button', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    expect(screen.getByRole('button', { name: /delete project/i })).toBeInTheDocument();
  });

  it('shows memory section when project has memory', () => {
    render(<ProjectSettingsForm project={makeProject({ memory: 'Remember this thing' })} />);
    expect(screen.getByText('Remember this thing')).toBeInTheDocument();
  });

  it('does not show memory section when project has no memory', () => {
    render(<ProjectSettingsForm project={makeProject({ memory: null })} />);
    expect(screen.queryByText(/managed by the agent/i)).not.toBeInTheDocument();
  });

  it('renders the model selector with default selected', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    const trigger = screen.getByRole('combobox', { name: /model/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Default (inherit)');
  });

  it('renders the model selector with existing model selected', () => {
    render(<ProjectSettingsForm project={makeProject({ model: 'claude-sonnet-4-6' })} />);
    const trigger = screen.getByRole('combobox', { name: /model/i });
    expect(trigger).toHaveTextContent('Sonnet');
  });

  it('calls updateProject with correct arguments on save', async () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    const nameInput = screen.getByLabelText(/^name$/i);
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ name: 'New Name' }));
    });
  });

  it('passes null model when default (inherit) is selected on save', async () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ model: null }));
    });
  });

  it('passes model value when a specific model is selected on save', async () => {
    render(<ProjectSettingsForm project={makeProject({ model: 'claude-sonnet-4-6' })} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ model: 'claude-sonnet-4-6' }));
    });
  });

  it('passes undefined for empty description on save', async () => {
    render(<ProjectSettingsForm project={makeProject({ description: null })} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({ description: undefined }));
    });
  });

  it('navigates to projects page after successful save', async () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/chat/projects');
    });
  });

  it('shows save error when updateProject throws', async () => {
    mockUpdateProject.mockRejectedValueOnce(new Error('Update failed'));
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('save button is disabled when name is cleared', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('shows confirmation prompt before deleting', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete project/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls deleteProject and navigates after confirming delete', async () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete project/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('proj-1');
      expect(mockPush).toHaveBeenCalledWith('/chat');
    });
  });

  it('shows a cancel option after first delete click', () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete project/i }));
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
  });

  it('hides cancel option when cancel button is clicked', async () => {
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete project/i }));
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  it('shows delete error and resets confirmation when deleteProject throws', async () => {
    mockDeleteProject.mockRejectedValueOnce(new Error('Delete failed'));
    render(<ProjectSettingsForm project={makeProject()} />);
    fireEvent.click(screen.getByRole('button', { name: /delete project/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });
  });
});
