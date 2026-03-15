import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({}));

const mockUpdateProject = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../_actions/update-project', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

vi.mock('../../../_actions/update-project', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

import { ProjectInstructionsPanel } from '../project-instructions-panel';

describe('ProjectInstructionsPanel', () => {
  beforeEach(() => {
    mockUpdateProject.mockClear();
  });

  it('renders empty state when instructions are null', () => {
    render(<ProjectInstructionsPanel projectId='proj-1' instructions={null} />);
    expect(screen.getByText(/no instructions set/i)).toBeInTheDocument();
  });

  it('renders existing instructions text', () => {
    render(<ProjectInstructionsPanel projectId='proj-1' instructions='Be helpful' />);
    expect(screen.getByText('Be helpful')).toBeInTheDocument();
  });

  it('enters edit mode when pencil button is clicked', () => {
    render(<ProjectInstructionsPanel projectId='proj-1' instructions='Be helpful' />);
    const editButtons = screen.getAllByRole('button');
    fireEvent.click(editButtons[0]!);
    expect(screen.getByRole('textbox')).toHaveValue('Be helpful');
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    expect(screen.getByText(/save/i)).toBeInTheDocument();
  });

  it('cancels editing and restores original value', () => {
    render(<ProjectInstructionsPanel projectId='proj-1' instructions='Original' />);
    const editButtons = screen.getAllByRole('button');
    fireEvent.click(editButtons[0]!);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Changed' },
    });
    fireEvent.click(screen.getByText(/cancel/i));
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('saves updated instructions', async () => {
    render(<ProjectInstructionsPanel projectId='proj-1' instructions='Old instructions' />);
    const editButtons = screen.getAllByRole('button');
    fireEvent.click(editButtons[0]!);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New instructions' },
    });
    fireEvent.click(screen.getByText(/save/i));
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', {
        instructions: 'New instructions',
      });
    });
  });
});
