import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRenameThread = vi.fn().mockResolvedValue(undefined);
const mockUpdateThreadModel = vi.fn().mockResolvedValue(undefined);
const mockUpdateThreadInstructions = vi.fn().mockResolvedValue(undefined);

vi.mock('../../_actions/rename-thread', () => ({
  renameThread: (...args: unknown[]) => mockRenameThread(...args),
}));

vi.mock('../../_actions/update-thread-model', () => ({
  updateThreadModel: (...args: unknown[]) => mockUpdateThreadModel(...args),
}));

vi.mock('../../_actions/update-thread-instructions', () => ({
  updateThreadInstructions: (...args: unknown[]) => mockUpdateThreadInstructions(...args),
}));

import { ManageThreadModal } from '../manage-thread-modal';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  threadId: 'thread-1',
  currentName: 'My Thread',
  currentModel: null,
  currentInstructions: null,
};

describe('ManageThreadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog when open is true', () => {
    render(<ManageThreadModal {...defaultProps} />);
    expect(screen.getByText('Chat Settings')).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    render(<ManageThreadModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Chat Settings')).not.toBeInTheDocument();
  });

  it('pre-fills the name input with currentName', () => {
    render(<ManageThreadModal {...defaultProps} currentName='Research Thread' />);
    expect(screen.getByLabelText('Name')).toHaveValue('Research Thread');
  });

  it('renders the custom instructions textarea', () => {
    render(<ManageThreadModal {...defaultProps} />);
    expect(screen.getByLabelText('Custom Instructions')).toBeInTheDocument();
  });

  it('pre-fills custom instructions textarea with currentInstructions', () => {
    render(<ManageThreadModal {...defaultProps} currentInstructions='Always be concise.' />);
    expect(screen.getByLabelText('Custom Instructions')).toHaveValue('Always be concise.');
  });

  it('initializes custom instructions to empty string when currentInstructions is null', () => {
    render(<ManageThreadModal {...defaultProps} currentInstructions={null} />);
    expect(screen.getByLabelText('Custom Instructions')).toHaveValue('');
  });

  it('calls updateThreadInstructions when instructions are changed and saved', async () => {
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} currentInstructions={null} />);

    const textarea = screen.getByLabelText('Custom Instructions');
    await user.clear(textarea);
    await user.type(textarea, 'Be formal.');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockUpdateThreadInstructions).toHaveBeenCalledWith('thread-1', 'Be formal.');
    });
  });

  it('does not call updateThreadInstructions when instructions are unchanged', async () => {
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} currentInstructions='Keep it short.' />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdateThreadInstructions).not.toHaveBeenCalled();
  });

  it('calls renameThread when the name is changed and saved', async () => {
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} currentName='Old Name' />);

    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockRenameThread).toHaveBeenCalledWith('thread-1', 'New Name');
    });
  });

  it('does not call renameThread when the name is unchanged', async () => {
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} currentName='Same Name' />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockRenameThread).not.toHaveBeenCalled();
  });

  it('calls onOpenChange(false) after saving', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ManageThreadModal {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders Save and Cancel buttons', () => {
    render(<ManageThreadModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
