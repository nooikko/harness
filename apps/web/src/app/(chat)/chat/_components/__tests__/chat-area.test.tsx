import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSendMessage = vi.fn();
vi.mock('../../_actions/send-message', () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockCheckForResponse = vi.fn();
vi.mock('../../_actions/check-for-response', () => ({
  checkForResponse: (...args: unknown[]) => mockCheckForResponse(...args),
}));

const mockUseWs = vi.fn().mockReturnValue({ lastEvent: null, isConnected: true });
vi.mock('../ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...args),
}));

vi.mock('../pipeline-activity', () => ({
  PipelineActivity: ({ threadId, isActive }: { threadId: string; isActive: boolean }) =>
    isActive ? (
      <div data-testid='pipeline-activity' data-thread-id={threadId}>
        Thinking...
      </div>
    ) : null,
}));

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const { ChatArea } = await import('../chat-area');

describe('ChatArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: true });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children inside the scroll area', () => {
    render(
      <ChatArea threadId='thread-1'>
        <div data-testid='child-content'>Message content</div>
      </ChatArea>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders a textarea and send button', () => {
    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    expect(screen.getByPlaceholderText('Send a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('renders a scroll anchor element', () => {
    const { container } = render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    expect(container.querySelector('[data-scroll-anchor]')).toBeInTheDocument();
  });

  it('calls sendMessage on form submit', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello world');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockSendMessage).toHaveBeenCalledWith('thread-1', 'Hello world');
  });

  it('clears textarea after successful send', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(textarea).toHaveValue('');
  });

  it('does not submit when textarea is empty', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('shows error message from sendMessage', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue({ error: 'Could not reach orchestrator. Make sure it is running.' });
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    await user.type(screen.getByPlaceholderText('Send a message...'), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/Could not reach orchestrator/)).toBeInTheDocument();
  });

  it('does not submit on Shift+Enter', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('submits on Enter key', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('thread-1', 'Hello');
  });

  it('calls router.refresh when pipeline:complete matches threadId', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-1' }, isConnected: true });

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does not call router.refresh when pipeline:complete has different threadId', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-other' }, isConnected: true });

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('ignores lastEvent when it is not an object', () => {
    mockUseWs.mockReturnValue({ lastEvent: 'not-an-object', isConnected: true });

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('renders PipelineActivity with correct threadId when thinking', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ChatArea threadId='thread-42'>{null}</ChatArea>);
    const textarea = screen.getByPlaceholderText('Send a message...');
    await user.type(textarea, 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    const activity = screen.getByTestId('pipeline-activity');
    expect(activity).toBeInTheDocument();
    expect(activity).toHaveAttribute('data-thread-id', 'thread-42');
  });

  it('does not render PipelineActivity when not thinking', () => {
    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);
    expect(screen.queryByTestId('pipeline-activity')).not.toBeInTheDocument();
  });

  it('does not poll when WebSocket is connected', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: true });
    mockSendMessage.mockResolvedValue(undefined);

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    const textarea = screen.getByPlaceholderText('Send a message...');
    textarea.focus();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(textarea, 'Hi');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).keyboard('{Enter}');

    await vi.advanceTimersByTimeAsync(6000);

    expect(mockCheckForResponse).not.toHaveBeenCalled();
  });

  it('polls for response when WebSocket is disconnected and isThinking', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });
    mockSendMessage.mockResolvedValue(undefined);
    mockCheckForResponse.mockResolvedValue(false);

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    const textarea = screen.getByPlaceholderText('Send a message...');
    textarea.focus();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(textarea, 'Hi');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).keyboard('{Enter}');

    await vi.advanceTimersByTimeAsync(3500);

    expect(mockCheckForResponse).toHaveBeenCalledWith('thread-1', expect.any(Date));
  });

  it('calls router.refresh when polling detects a response', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });
    mockSendMessage.mockResolvedValue(undefined);
    mockCheckForResponse.mockResolvedValue(true);

    render(<ChatArea threadId='thread-1'>{null}</ChatArea>);

    const textarea = screen.getByPlaceholderText('Send a message...');
    textarea.focus();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(textarea, 'Hi');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).keyboard('{Enter}');

    await vi.advanceTimersByTimeAsync(3500);

    expect(mockRefresh).toHaveBeenCalled();
  });
});
