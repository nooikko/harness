import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type WsOverrides = Record<string, { lastEvent: unknown; isConnected: boolean }>;
let wsOverrides: WsOverrides = {};

const mockUseWs = vi.fn().mockImplementation((eventName: string) => {
  if (wsOverrides[eventName]) {
    return wsOverrides[eventName];
  }
  return { lastEvent: null, isConnected: true };
});
vi.mock('@/app/_components/ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...(args as [string])),
}));

vi.mock('../markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid='markdown-content'>{content}</div>,
}));

const { StreamingMessage } = await import('../streaming-message');

describe('StreamingMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsOverrides = {};
  });

  it('renders nothing when not active', () => {
    const { container } = render(<StreamingMessage threadId='thread-1' isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when active but no assistant text has arrived', () => {
    const { container } = render(<StreamingMessage threadId='thread-1' isActive={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders assistant text from pipeline:stream events', () => {
    wsOverrides['pipeline:stream'] = {
      lastEvent: {
        threadId: 'thread-1',
        event: {
          type: 'assistant',
          content: 'Hello world',
          timestamp: Date.now(),
        },
      },
      isConnected: true,
    };

    render(<StreamingMessage threadId='thread-1' isActive={true} />);
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Hello world');
  });

  it('ignores events from other threads', () => {
    wsOverrides['pipeline:stream'] = {
      lastEvent: {
        threadId: 'thread-other',
        event: {
          type: 'assistant',
          content: 'Wrong thread',
          timestamp: Date.now(),
        },
      },
      isConnected: true,
    };

    const { container } = render(<StreamingMessage threadId='thread-1' isActive={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('ignores non-assistant stream events', () => {
    wsOverrides['pipeline:stream'] = {
      lastEvent: {
        threadId: 'thread-1',
        event: {
          type: 'thinking',
          content: 'Internal reasoning',
          timestamp: Date.now(),
        },
      },
      isConnected: true,
    };

    const { container } = render(<StreamingMessage threadId='thread-1' isActive={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('clears accumulated text when isActive becomes false', () => {
    wsOverrides['pipeline:stream'] = {
      lastEvent: {
        threadId: 'thread-1',
        event: {
          type: 'assistant',
          content: 'Hello world',
          timestamp: Date.now(),
        },
      },
      isConnected: true,
    };

    const { container, rerender } = render(<StreamingMessage threadId='thread-1' isActive={true} />);
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();

    // Deactivate — should clear and render nothing
    rerender(<StreamingMessage threadId='thread-1' isActive={false} />);
    expect(container.firstChild).toBeNull();
  });
});
