import { render, screen } from '@testing-library/react';
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

vi.mock('lexical-beautiful-mentions', () => ({
  BeautifulMentionNode: class {
    getTrigger = mockGetTrigger;
    getValue = mockGetValue;
    getData = mockGetData;
  },
  BeautifulMentionsPlugin: () => null,
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

const { ChatInput } = await import('../chat-input');

describe('ChatInput', () => {
  it('renders the send button', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} error='Something went wrong' />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not show error element when error is null', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} error={null} />);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('disables the send button when disabled prop is true', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} disabled={true} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('enables the send button when disabled prop is false', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: /send message/i })).not.toBeDisabled();
  });

  it('renders the hint text', () => {
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} />);
    expect(screen.getByText(/Enter to send/)).toBeInTheDocument();
  });

  it('dispatches KEY_ENTER_COMMAND when send button is clicked', async () => {
    const user = userEvent.setup();
    mockDispatchCommand.mockClear();
    render(<ChatInput threadId='thread-1' onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(mockDispatchCommand).toHaveBeenCalledOnce();
  });

  it('passes onSubmit prop down to SubmitPlugin', () => {
    MockSubmitPlugin.mockClear();
    const onSubmit = vi.fn();
    render(<ChatInput threadId='thread-1' onSubmit={onSubmit} />);
    expect(MockSubmitPlugin).toHaveBeenCalled();
    const { onSubmit: passedOnSubmit } = MockSubmitPlugin.mock.calls[0]![0] as {
      onSubmit: (text: string) => void;
    };
    // The passed onSubmit should be a stable wrapper that forwards to onSubmit
    passedOnSubmit('test message');
    expect(onSubmit).toHaveBeenCalledWith('test message');
  });
});
