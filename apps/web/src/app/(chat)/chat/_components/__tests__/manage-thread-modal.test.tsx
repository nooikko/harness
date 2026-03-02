import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockRenameThread = vi.fn().mockResolvedValue(undefined);
const mockUpdateThreadModel = vi.fn().mockResolvedValue(undefined);

vi.mock('../../_actions/rename-thread', () => ({
  renameThread: (...args: unknown[]) => mockRenameThread(...args),
}));

vi.mock('../../_actions/update-thread-model', () => ({
  updateThreadModel: (...args: unknown[]) => mockUpdateThreadModel(...args),
}));

// Radix Select forbids SelectItem with value="". Stub the Select family so the
// component tree renders without the constraint. onValueChange is stored in a
// module-level ref so SelectItem buttons can invoke it without prop drilling.
let selectOnValueChange: ((v: string) => void) | undefined;

vi.mock('@harness/ui', async (importActual) => {
  const actual = await importActual<typeof import('@harness/ui')>();
  return {
    ...actual,
    Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void; defaultValue?: string }) => {
      selectOnValueChange = onValueChange;
      return <div data-testid='select'>{children}</div>;
    },
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
      <button type='button' id={id}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <button type='button' data-value={value} onClick={() => selectOnValueChange?.(value)}>
        {children}
      </button>
    ),
  };
});

import { ManageThreadModal } from '../manage-thread-modal';

describe('ManageThreadModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    selectOnValueChange = undefined;
  });

  it('renders nothing when open is false', () => {
    render(<ManageThreadModal open={false} onOpenChange={vi.fn()} threadId='t1' currentName='My Chat' currentModel={null} />);

    expect(screen.queryByText('Chat Settings')).not.toBeInTheDocument();
  });

  it('renders the dialog title when open is true', () => {
    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName='My Chat' currentModel={null} />);

    expect(screen.getByText('Chat Settings')).toBeInTheDocument();
  });

  it('renders the name input with the current name pre-filled', () => {
    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName='My Chat' currentModel={null} />);

    expect(screen.getByLabelText('Name')).toHaveValue('My Chat');
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<ManageThreadModal open={true} onOpenChange={onOpenChange} threadId='t1' currentName='My Chat' currentModel={null} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders all four model option buttons', () => {
    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName={null} currentModel={null} />);

    // 4 SelectItem stubs + Cancel + Save = 6 buttons total; filter by data-value
    const optionButtons = screen.getAllByRole('button').filter((b) => b.hasAttribute('data-value'));
    expect(optionButtons).toHaveLength(4);
  });

  it('renders the Custom Instructions textarea', () => {
    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName={null} currentModel={null} />);

    expect(screen.getByLabelText('Custom Instructions')).toBeInTheDocument();
  });

  it('calls renameThread when name changes on Save', async () => {
    const user = userEvent.setup();

    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName='Old Name' currentModel={null} />);

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockRenameThread).toHaveBeenCalledWith('t1', 'New Name');
    expect(mockUpdateThreadModel).not.toHaveBeenCalled();
  });

  it('calls updateThreadModel when model changes on Save', async () => {
    const user = userEvent.setup();

    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName='My Chat' currentModel={null} />);

    await user.click(screen.getByRole('button', { name: 'Sonnet' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdateThreadModel).toHaveBeenCalledWith('t1', 'claude-sonnet-4-6');
    expect(mockRenameThread).not.toHaveBeenCalled();
  });

  it('does not call actions when nothing changes on Save', async () => {
    const user = userEvent.setup();

    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName='My Chat' currentModel={null} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockRenameThread).not.toHaveBeenCalled();
    expect(mockUpdateThreadModel).not.toHaveBeenCalled();
  });

  it('calls updateThreadModel with null when model is cleared', async () => {
    const user = userEvent.setup();

    render(<ManageThreadModal open={true} onOpenChange={vi.fn()} threadId='t1' currentName={null} currentModel='claude-sonnet-4-6' />);

    // Click the default (empty value) option to clear the model
    const optionButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('data-value') === '');
    await user.click(optionButtons[0]!);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdateThreadModel).toHaveBeenCalledWith('t1', null);
  });
});
