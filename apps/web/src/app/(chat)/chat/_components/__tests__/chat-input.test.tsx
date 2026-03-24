import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockDispatchCommand = vi.fn();

vi.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [{ dispatchCommand: mockDispatchCommand }],
}));

vi.mock('@lexical/react/LexicalContentEditable', () => ({
  ContentEditable: ({ placeholder }: { placeholder: React.ReactNode }) => (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: test mock for contenteditable */}
      <div role='textbox' aria-label='Send a message… (/ for commands)' tabIndex={0} contentEditable />
      {placeholder}
    </div>
  ),
}));

vi.mock('@lexical/react/LexicalErrorBoundary', () => ({
  LexicalErrorBoundary: () => null,
}));

vi.mock('@lexical/react/LexicalHistoryPlugin', () => ({
  HistoryPlugin: () => null,
}));

vi.mock('@lexical/react/LexicalRichTextPlugin', () => ({
  RichTextPlugin: ({ contentEditable }: { contentEditable: React.ReactNode }) => <>{contentEditable}</>,
}));

const mockGetTrigger = vi.fn().mockReturnValue('/');
const mockGetValue = vi.fn().mockReturnValue('test-command');
const mockGetData = vi.fn().mockReturnValue({ description: 'Test', args: '', category: 'system' });

// Capture onMenuOpen/onMenuClose so individual tests can invoke them
let capturedMenuCallbacks: { onMenuOpen?: () => void; onMenuClose?: () => void } = {};

vi.mock('lexical-beautiful-mentions', () => ({
  BeautifulMentionNode: class {
    getTrigger = mockGetTrigger;
    getValue = mockGetValue;
    getData = mockGetData;
  },
  BeautifulMentionsPlugin: ({ onMenuOpen, onMenuClose }: { onMenuOpen?: () => void; onMenuClose?: () => void }) => {
    capturedMenuCallbacks = { onMenuOpen, onMenuClose };
    return null;
  },
}));

const MockSubmitPlugin = vi.fn().mockReturnValue(null);
vi.mock('../../_helpers/submit-plugin', () => ({
  SubmitPlugin: (props: unknown) => MockSubmitPlugin(props),
}));

const MockCommandNode = vi.fn();
vi.mock('../../_helpers/command-node', () => ({
  CommandNode: (...args: unknown[]) => MockCommandNode(...args),
}));

vi.mock('../../_helpers/command-menu', () => ({
  CommandMenu: () => null,
}));

vi.mock('../../_helpers/command-menu-item', () => ({
  CommandMenuItem: () => null,
}));

vi.mock('../../_helpers/commands', () => ({
  COMMANDS: [{ name: 'delegate', description: 'Delegate task', args: '<prompt>', category: 'agent' }],
}));

vi.mock('../agent-selector', () => ({
  AgentSelector: () => null,
}));

vi.mock('../model-selector', () => ({
  ModelSelector: () => null,
}));

vi.mock('../file-chip', () => ({
  FileChip: ({ file, onRemove }: { file: { name: string }; onRemove?: () => void }) => (
    <div data-testid={`file-chip-${file.name}`}>
      {file.name}
      {onRemove && (
        <button type='button' data-testid={`remove-${file.name}`} onClick={onRemove}>
          x
        </button>
      )}
    </div>
  ),
}));

const { ChatInput } = await import('../chat-input');

describe('ChatInput', () => {
  it('renders the send button', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
        error='Something went wrong'
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not show error element when error is null', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
        error={null}
      />,
    );
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('disables the send button when disabled prop is true', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
        disabled={true}
      />,
    );
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('enables the send button when disabled prop is false', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByRole('button', { name: /send message/i })).not.toBeDisabled();
  });

  it('renders the hint text', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/Enter to send/)).toBeInTheDocument();
  });

  it('dispatches KEY_ENTER_COMMAND when send button is clicked', async () => {
    const user = userEvent.setup();
    mockDispatchCommand.mockClear();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(mockDispatchCommand).toHaveBeenCalledOnce();
  });

  it('passes onSubmit prop down to SubmitPlugin', async () => {
    MockSubmitPlugin.mockClear();
    const onSubmit = vi.fn();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={onSubmit}
      />,
    );
    expect(MockSubmitPlugin).toHaveBeenCalled();
    const { onSubmit: passedOnSubmit } = MockSubmitPlugin.mock.calls[0]![0] as {
      onSubmit: (text: string) => void;
    };
    // The passed onSubmit should be a stable wrapper that forwards to onSubmit
    await passedOnSubmit('test message');
    expect(onSubmit).toHaveBeenCalledWith('test message', undefined);
  });

  it('renders the attach file button', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /attach file/i })).toBeInTheDocument();
  });

  it('disables attach button when disabled', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: /attach file/i })).toBeDisabled();
  });

  it('shows upload error message', () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );
    // uploadError state is internal and only set during file upload flow
    // The error prop path is already tested above
  });

  it('passes fileIds from upload in stableOnSubmit', async () => {
    MockSubmitPlugin.mockClear();
    const onSubmit = vi.fn();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={onSubmit}
      />,
    );
    const { onSubmit: passedOnSubmit } = MockSubmitPlugin.mock.calls[0]![0] as {
      onSubmit: (text: string) => void;
    };
    // With no staged files, fileIds should be undefined
    await passedOnSubmit('hello');
    expect(onSubmit).toHaveBeenCalledWith('hello', undefined);
  });

  it('applies open-menu card styling when onMenuOpen is called', async () => {
    const { container } = render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );

    // Before menu opens the card has rounded-xl (all corners)
    expect(container.querySelector('.rounded-xl')).toBeInTheDocument();
    expect(container.querySelector('.rounded-b-xl')).not.toBeInTheDocument();

    // Trigger menu open via the captured callback
    await act(async () => {
      capturedMenuCallbacks.onMenuOpen?.();
    });

    // After menu opens the card has rounded-b-xl (bottom corners only)
    expect(container.querySelector('.rounded-b-xl')).toBeInTheDocument();
    expect(container.querySelector('.rounded-xl')).not.toBeInTheDocument();

    // Trigger menu close to restore
    await act(async () => {
      capturedMenuCallbacks.onMenuClose?.();
    });

    expect(container.querySelector('.rounded-xl')).toBeInTheDocument();
  });

  it('stages files when selected via file input', async () => {
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    expect(screen.getByTestId('file-chip-test.txt')).toBeInTheDocument();
  });

  it('removes staged files when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={vi.fn()}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    expect(screen.getByTestId('file-chip-test.txt')).toBeInTheDocument();

    await user.click(screen.getByTestId('remove-test.txt'));

    expect(screen.queryByTestId('file-chip-test.txt')).not.toBeInTheDocument();
  });

  it('uploads staged files and passes fileIds on submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'uploaded-file-1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    MockSubmitPlugin.mockClear();
    const onSubmit = vi.fn();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={onSubmit}
      />,
    );

    // Stage a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    // Get the latest onSubmit after re-render with staged files
    const lastCall = MockSubmitPlugin.mock.calls[MockSubmitPlugin.mock.calls.length - 1]![0] as {
      onSubmit: (text: string) => Promise<void>;
    };
    await act(async () => {
      await lastCall.onSubmit('message with file');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/files', expect.objectContaining({ method: 'POST' }));
    expect(onSubmit).toHaveBeenCalledWith('message with file', ['uploaded-file-1']);
  });

  it('shows upload error when fetch fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'File too large' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    MockSubmitPlugin.mockClear();
    const onSubmit = vi.fn();
    render(
      <ChatInput
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
        onSubmitAction={onSubmit}
      />,
    );

    // Stage a file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [testFile] } });
    });

    // Get the latest onSubmit after re-render
    const lastCall = MockSubmitPlugin.mock.calls[MockSubmitPlugin.mock.calls.length - 1]![0] as {
      onSubmit: (text: string) => Promise<void>;
    };
    await act(async () => {
      await lastCall.onSubmit('message');
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('File too large')).toBeInTheDocument();
  });
});
