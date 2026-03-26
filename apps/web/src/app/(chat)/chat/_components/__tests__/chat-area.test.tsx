import { act, render, screen } from '@testing-library/react';
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

const mockGetActivePipeline = vi.fn().mockResolvedValue({ active: false });
vi.mock('../../_actions/get-active-pipeline', () => ({
  getActivePipeline: (...args: unknown[]) => mockGetActivePipeline(...args),
}));

const mockUseWs = vi.fn().mockReturnValue({ lastEvent: null, isConnected: true });
vi.mock('@/app/_components/ws-provider', () => ({
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

vi.mock('../delegation-stack', () => ({
  DelegationStack: () => null,
}));

vi.mock('../streaming-message', () => ({
  StreamingMessage: () => null,
}));

// IntersectionObserver mock — captures the callback so tests can simulate visibility changes
let intersectionCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    intersectionCallback = cb;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

vi.mock('../chat-input', () => ({
  ChatInput: ({
    onSubmitAction,
    disabled,
    error,
  }: {
    onSubmitAction: (text: string, fileIds?: string[]) => void;
    disabled?: boolean;
    error?: string | null;
  }) => (
    <div>
      {error && <p data-testid='error-message'>{error}</p>}
      <button type='button' disabled={disabled} onClick={() => onSubmitAction('test message')} aria-label='Send message'>
        Send
      </button>
    </div>
  ),
}));

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        <div data-testid='child-content'>Message content</div>
      </ChatArea>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders ChatInput with a send button', () => {
    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('renders a scroll anchor element', () => {
    const { container } = render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    expect(container.querySelector('[data-scroll-anchor]')).toBeInTheDocument();
  });

  it('calls sendMessage when ChatInput onSubmit is invoked', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(mockSendMessage).toHaveBeenCalledWith('thread-1', 'test message', undefined);
  });

  it('shows error message from sendMessage via ChatInput error prop', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue({ error: 'Could not reach orchestrator. Make sure it is running.' });
    const user = userEvent.setup();

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByTestId('error-message')).toHaveTextContent(/Could not reach orchestrator/);
  });

  it('disables ChatInput while pending', async () => {
    vi.useRealTimers();
    // sendMessage never resolves so isPending stays true
    mockSendMessage.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    const btn = screen.getByRole('button', { name: /send message/i });
    await user.click(btn);

    expect(btn).toBeDisabled();
  });

  it('calls router.refresh when pipeline:complete matches threadId', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-1' }, isConnected: true });

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does not call router.refresh when pipeline:complete has different threadId', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-other' }, isConnected: true });

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('ignores lastEvent when it is not an object', () => {
    mockUseWs.mockReturnValue({ lastEvent: 'not-an-object', isConnected: true });

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('renders PipelineActivity with correct threadId when thinking', async () => {
    vi.useRealTimers();
    mockSendMessage.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ChatArea
        threadId='thread-42'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const activity = screen.getByTestId('pipeline-activity');
    expect(activity).toBeInTheDocument();
    expect(activity).toHaveAttribute('data-thread-id', 'thread-42');
  });

  it('does not render PipelineActivity when not thinking', () => {
    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );
    expect(screen.queryByTestId('pipeline-activity')).not.toBeInTheDocument();
  });

  it('does not poll when WebSocket is connected', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: true });
    mockSendMessage.mockResolvedValue(undefined);

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: /send message/i }));

    await vi.advanceTimersByTimeAsync(6000);

    expect(mockCheckForResponse).not.toHaveBeenCalled();
  });

  it('polls for response when WebSocket is disconnected and isThinking', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });
    mockSendMessage.mockResolvedValue(undefined);
    mockCheckForResponse.mockResolvedValue(false);

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: /send message/i }));

    await vi.advanceTimersByTimeAsync(3500);

    expect(mockCheckForResponse).toHaveBeenCalledWith('thread-1', expect.any(Date));
  });

  it('calls router.refresh when polling detects a response', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });
    mockSendMessage.mockResolvedValue(undefined);
    mockCheckForResponse.mockResolvedValue(true);

    render(
      <ChatArea
        threadId='thread-1'
        currentModel={null}
        currentAgentId={null}
        currentAgentName={null}
        currentEffort={null}
        currentPermissionMode={null}
      >
        {null}
      </ChatArea>,
    );

    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: /send message/i }));

    await vi.advanceTimersByTimeAsync(3500);

    expect(mockRefresh).toHaveBeenCalled();
  });

  describe('scroll-to-bottom button', () => {
    const renderChatArea = () =>
      render(
        <ChatArea
          threadId='thread-1'
          currentModel={null}
          currentAgentId={null}
          currentAgentName={null}
          currentEffort={null}
          currentPermissionMode={null}
        >
          <div>Messages</div>
        </ChatArea>,
      );

    it('does not show the scroll-to-bottom button when anchor is visible (at bottom)', () => {
      renderChatArea();

      // Simulate anchor being visible (user is at bottom)
      act(() => {
        intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      expect(screen.queryByRole('button', { name: /scroll to bottom/i })).not.toBeInTheDocument();
    });

    it('shows the scroll-to-bottom button when anchor is not visible (scrolled up)', () => {
      renderChatArea();

      // Simulate anchor being hidden (user scrolled up)
      act(() => {
        intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      expect(screen.getByRole('button', { name: /scroll to bottom/i })).toBeInTheDocument();
    });

    it('scrolls to bottom when the button is clicked', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      renderChatArea();

      // Show the button
      act(() => {
        intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      await user.click(screen.getByRole('button', { name: /scroll to bottom/i }));

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'end',
      });
    });

    it('observes the scroll anchor element', () => {
      renderChatArea();

      expect(mockObserve).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });

    it('disconnects observer on unmount', () => {
      const { unmount } = renderChatArea();
      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
