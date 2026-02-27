import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSystemCommand, SubmitPlugin } from '../submit-plugin';

// --- Mocks ---

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

vi.mock('../../_actions/create-thread', () => ({
  createThread: () => mockCreateThread(),
}));

vi.mock('../../_actions/update-thread-model', () => ({
  updateThreadModel: (...args: unknown[]) => mockUpdateThreadModel(...args),
}));

const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const mockCreateThread = vi.fn();
const mockUpdateThreadModel = vi.fn();

// --- Helpers ---

type RenderEditorOptions = {
  threadId?: string;
  onSubmit?: (text: string) => void;
  disabled?: boolean;
};

// Renders a LexicalComposer with SubmitPlugin attached to a real ContentEditable.
// Returns the contenteditable DOM node for firing keyboard events.
const renderEditor = async ({ threadId = 'thread-1', onSubmit = vi.fn(), disabled = false }: RenderEditorOptions = {}) => {
  let editorInstance: import('lexical').LexicalEditor | null = null;

  const { useLexicalComposerContext } = await import('@lexical/react/LexicalComposerContext');

  const CapturePlugin = () => {
    const [editor] = useLexicalComposerContext();
    editorInstance = editor;
    return null;
  };

  render(
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        onError: (e) => {
          throw e;
        },
      }}
    >
      <PlainTextPlugin
        contentEditable={<ContentEditable data-testid='editor' />}
        placeholder={null}
        ErrorBoundary={({ children }) => <>{children}</>}
      />
      <SubmitPlugin threadId={threadId} onSubmit={onSubmit} disabled={disabled} />
      <CapturePlugin />
    </LexicalComposer>,
  );

  const editableEl = screen.getByTestId('editor');

  // Helper to set text in the editor programmatically
  const setText = async (text: string) => {
    await act(async () => {
      editorInstance?.update(
        () => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(text));
          root.append(paragraph);
        },
        { discrete: true },
      );
    });
  };

  // Helper to press Enter on the editable element
  const pressEnter = (options: { shiftKey?: boolean } = {}) => {
    fireEvent.keyDown(editableEl, {
      key: 'Enter',
      code: 'Enter',
      ...options,
    });
  };

  return { editableEl, setText, pressEnter, onSubmit };
};

// --- parseSystemCommand tests (pure function, no Lexical required) ---

describe('parseSystemCommand', () => {
  it('returns null for regular prose messages', () => {
    expect(parseSystemCommand('Hello world')).toBeNull();
    expect(parseSystemCommand('what is the weather?')).toBeNull();
  });

  it('returns null for agent-output commands (delegate, checkin)', () => {
    expect(parseSystemCommand('/delegate build me a React app')).toBeNull();
    expect(parseSystemCommand('/checkin progress update')).toBeNull();
    expect(parseSystemCommand('/re-delegate amended prompt')).toBeNull();
  });

  it('returns null for /current-time (handled by backend, not frontend)', () => {
    expect(parseSystemCommand('/current-time')).toBeNull();
  });

  it('detects /new', () => {
    expect(parseSystemCommand('/new')).toEqual({ command: 'new', args: '' });
  });

  it('detects /clear', () => {
    expect(parseSystemCommand('/clear')).toEqual({ command: 'clear', args: '' });
  });

  it('detects /model with a model name argument', () => {
    expect(parseSystemCommand('/model claude-opus-4-6')).toEqual({
      command: 'model',
      args: 'claude-opus-4-6',
    });
  });

  it('trims whitespace from args', () => {
    expect(parseSystemCommand('/model  claude-sonnet-4-6  ')).toEqual({
      command: 'model',
      args: 'claude-sonnet-4-6',
    });
  });

  it('requires the command to be at the start of the message', () => {
    expect(parseSystemCommand('please /new')).toBeNull();
  });

  it('is case-sensitive — /New is not a system command', () => {
    expect(parseSystemCommand('/New')).toBeNull();
    expect(parseSystemCommand('/MODEL claude-opus-4-6')).toBeNull();
  });
});

// --- SubmitPlugin component tests ---

describe('SubmitPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.push.mockReset();
    mockRouter.refresh.mockReset();
    mockCreateThread.mockReset();
    mockUpdateThreadModel.mockReset();
    mockCreateThread.mockResolvedValue({ threadId: 'new-thread-id' });
    mockUpdateThreadModel.mockResolvedValue(undefined);
  });

  it('renders null — produces no additional DOM output', async () => {
    const { editableEl } = await renderEditor();
    // ContentEditable is rendered by PlainTextPlugin, not SubmitPlugin
    expect(editableEl).toBeInTheDocument();
  });

  it('mounts without throwing', async () => {
    await expect(renderEditor()).resolves.toBeDefined();
  });

  it('calls onSubmit with the trimmed text when Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { setText, pressEnter } = await renderEditor({ onSubmit });

    await setText('Hello world');
    await act(async () => {
      pressEnter();
    });

    expect(onSubmit).toHaveBeenCalledWith('Hello world');
  });

  it('does not call onSubmit when the editor is empty on Enter', async () => {
    const onSubmit = vi.fn();
    const { pressEnter } = await renderEditor({ onSubmit });

    await act(async () => {
      pressEnter();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit on Shift+Enter (allows newline)', async () => {
    const onSubmit = vi.fn();
    const { setText, pressEnter } = await renderEditor({ onSubmit });

    await setText('Hello world');
    await act(async () => {
      pressEnter({ shiftKey: true });
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when disabled, even with text present', async () => {
    const onSubmit = vi.fn();
    const { setText, pressEnter } = await renderEditor({ onSubmit, disabled: true });

    await setText('Hello');
    await act(async () => {
      pressEnter();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls createThread and navigates when /new is entered', async () => {
    const { setText, pressEnter } = await renderEditor();

    await setText('/new');
    await act(async () => {
      pressEnter();
      await Promise.resolve();
    });

    expect(mockCreateThread).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/new-thread-id');
  });

  it('calls createThread and navigates when /clear is entered', async () => {
    const { setText, pressEnter } = await renderEditor();

    await setText('/clear');
    await act(async () => {
      pressEnter();
      await Promise.resolve();
    });

    expect(mockCreateThread).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/chat/new-thread-id');
  });

  it('calls updateThreadModel and refreshes when /model <name> is entered', async () => {
    const { setText, pressEnter } = await renderEditor({ threadId: 'thread-abc' });

    await setText('/model claude-opus-4-6');
    await act(async () => {
      pressEnter();
      await Promise.resolve();
    });

    expect(mockUpdateThreadModel).toHaveBeenCalledWith('thread-abc', 'claude-opus-4-6');
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
