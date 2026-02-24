import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EventHandler = (event: unknown) => void;

let handlers: Record<string, EventHandler>;

const mockWsInstance = {
  close: vi.fn(),
  addEventListener: vi.fn((event: string, handler: EventHandler) => {
    handlers[event] = handler;
  }),
  removeEventListener: vi.fn(),
  readyState: 1,
};

// eslint-disable-next-line -- must use function keyword for constructor mock
vi.stubGlobal(
  'WebSocket',
  vi.fn(function MockWebSocket() {
    return mockWsInstance;
  }),
);

const { WsProvider, useWs } = await import('../ws-provider');

const TestConsumer = ({ event }: { event: string }) => {
  const { lastEvent, isConnected } = useWs(event);
  return (
    <div>
      <div data-testid='event-data'>{lastEvent ? JSON.stringify(lastEvent) : 'none'}</div>
      <div data-testid='connected'>{String(isConnected)}</div>
    </div>
  );
};

describe('WsProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    handlers = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <WsProvider>
        <div>child content</div>
      </WsProvider>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('creates WebSocket connection on mount', () => {
    render(
      <WsProvider>
        <div>test</div>
      </WsProvider>,
    );
    expect(WebSocket).toHaveBeenCalled();
  });

  it('sets isConnected to true on open', () => {
    render(
      <WsProvider>
        <TestConsumer event='test' />
      </WsProvider>,
    );

    act(() => {
      handlers.open?.({});
    });

    expect(screen.getByTestId('connected')).toHaveTextContent('true');
  });

  it('sets isConnected to false on close and schedules reconnect', () => {
    render(
      <WsProvider>
        <TestConsumer event='test' />
      </WsProvider>,
    );

    act(() => {
      handlers.open?.({});
    });
    expect(screen.getByTestId('connected')).toHaveTextContent('true');

    act(() => {
      handlers.close?.({});
    });
    expect(screen.getByTestId('connected')).toHaveTextContent('false');

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(WebSocket).toHaveBeenCalledTimes(2);
  });

  it('dispatches message data to subscribers', () => {
    render(
      <WsProvider>
        <TestConsumer event='pipeline:complete' />
      </WsProvider>,
    );

    act(() => {
      handlers.message?.({
        data: JSON.stringify({
          event: 'pipeline:complete',
          data: { threadId: 't-1' },
          timestamp: 1,
        }),
      });
    });

    expect(screen.getByTestId('event-data')).toHaveTextContent('{"threadId":"t-1"}');
  });

  it('ignores malformed JSON messages', () => {
    render(
      <WsProvider>
        <TestConsumer event='test' />
      </WsProvider>,
    );

    act(() => {
      handlers.message?.({ data: 'not valid json' });
    });

    expect(screen.getByTestId('event-data')).toHaveTextContent('none');
  });

  it('ignores messages for events with no subscribers', () => {
    render(
      <WsProvider>
        <TestConsumer event='other-event' />
      </WsProvider>,
    );

    act(() => {
      handlers.message?.({
        data: JSON.stringify({
          event: 'unsubscribed-event',
          data: { value: 1 },
          timestamp: 1,
        }),
      });
    });

    expect(screen.getByTestId('event-data')).toHaveTextContent('none');
  });

  it('cleans up WebSocket on unmount', () => {
    const { unmount } = render(
      <WsProvider>
        <div>test</div>
      </WsProvider>,
    );

    unmount();
    expect(mockWsInstance.close).toHaveBeenCalled();
  });

  it('clears reconnect timeout on unmount', () => {
    const { unmount } = render(
      <WsProvider>
        <div>test</div>
      </WsProvider>,
    );

    act(() => {
      handlers.close?.({});
    });

    unmount();
    expect(mockWsInstance.close).toHaveBeenCalled();
  });

  it('provides event data to consumers via useWs', () => {
    render(
      <WsProvider>
        <TestConsumer event='pipeline:complete' />
      </WsProvider>,
    );

    expect(screen.getByTestId('event-data')).toHaveTextContent('none');
  });
});

describe('useWs', () => {
  it('throws when used outside WsProvider', () => {
    expect(() => {
      renderHook(() => useWs('test'));
    }).toThrow('useWs must be used within a WsProvider');
  });
});
