import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WsOverrides = Record<string, { lastEvent: unknown; isConnected: boolean }>;
let wsOverrides: WsOverrides = {};

const mockUseWs = vi.fn().mockImplementation((eventName: string) => {
  if (wsOverrides[eventName]) {
    return wsOverrides[eventName];
  }
  return { lastEvent: null, isConnected: true };
});
const mockUseWsReconnect = vi.fn();
vi.mock('@/app/_components/ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...(args as [string])),
  useWsReconnect: (...args: unknown[]) => mockUseWsReconnect(...args),
}));

vi.mock('../../_actions/get-active-pipeline', () => ({
  getActivePipeline: vi.fn().mockResolvedValue({ active: false }),
}));

vi.mock('../pipeline-step', () => ({
  LivePipelineStep: ({ stepData }: { stepData: { step: string; detail?: string } }) => <div data-testid='pipeline-step'>{stepData.step}</div>,
  STEP_LABELS: {
    onMessage: 'Processing message',
    onBeforeInvoke: 'Preparing prompt',
    invoking: 'Calling Claude',
    onAfterInvoke: 'Processing response',
  } as Record<string, string>,
}));

const { PipelineActivity } = await import('../pipeline-activity');

describe('PipelineActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsOverrides = {};
  });

  it('renders nothing when not active', () => {
    const { container } = render(<PipelineActivity threadId='thread-1' isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows starting indicator when active with no events', () => {
    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(screen.getByText(/starting/i)).toBeInTheDocument();
  });

  it('shows pipeline steps as they arrive', () => {
    wsOverrides['pipeline:step'] = {
      lastEvent: {
        threadId: 'thread-1',
        step: 'invoking',
        detail: 'Sonnet',
        timestamp: Date.now(),
      },
      isConnected: true,
    };

    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(screen.getAllByText(/calling claude/i).length).toBeGreaterThan(0);
  });

  it('ignores pipeline steps for other threads', () => {
    wsOverrides['pipeline:step'] = {
      lastEvent: {
        threadId: 'thread-other',
        step: 'invoking',
        detail: 'Sonnet',
        timestamp: Date.now(),
      },
      isConnected: true,
    };

    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    // Should show Starting but NOT the step detail for other thread
    expect(screen.getByText(/starting/i)).toBeInTheDocument();
    expect(screen.queryByText(/sonnet/i)).not.toBeInTheDocument();
  });

  it('subscribes to pipeline:step events', () => {
    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(mockUseWs).toHaveBeenCalledWith('pipeline:step');
  });

  describe('unresponsive detection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not flag unresponsive within 60s when stream events arrive', () => {
      // Pipeline has started with a step
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'invoking', detail: 'Sonnet', timestamp: Date.now() },
        isConnected: true,
      };
      // Stream event arrives (thinking) — proof of life
      wsOverrides['pipeline:stream'] = {
        lastEvent: { threadId: 'thread-1', event: { type: 'thinking', content: 'reasoning...', timestamp: Date.now() } },
        isConnected: true,
      };

      render(<PipelineActivity threadId='thread-1' isActive={true} />);

      // Advance 35s — would trigger old 30s threshold, but stream event should have reset timer
      act(() => vi.advanceTimersByTime(35_000));

      expect(screen.queryByText(/unresponsive/i)).not.toBeInTheDocument();
    });

    it('does not flag unresponsive within 60s when step events arrive', () => {
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'onBeforeInvoke', timestamp: Date.now() },
        isConnected: true,
      };

      render(<PipelineActivity threadId='thread-1' isActive={true} />);

      // Advance 35s — step event should have reset timer
      act(() => vi.advanceTimersByTime(35_000));

      expect(screen.queryByText(/unresponsive/i)).not.toBeInTheDocument();
    });

    it('flags unresponsive after 60s of total silence', () => {
      // Initial step to start the pipeline
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'invoking', detail: 'Sonnet', timestamp: Date.now() },
        isConnected: true,
      };

      render(<PipelineActivity threadId='thread-1' isActive={true} />);

      // Advance past 60s with no further events
      act(() => vi.advanceTimersByTime(65_000));

      expect(screen.getByText(/unresponsive/i)).toBeInTheDocument();
    });

    it('does not flag unresponsive at 30s (old threshold)', () => {
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'invoking', detail: 'Sonnet', timestamp: Date.now() },
        isConnected: true,
      };

      render(<PipelineActivity threadId='thread-1' isActive={true} />);

      // At 30s, should NOT be flagged (new threshold is 60s)
      act(() => vi.advanceTimersByTime(32_000));

      expect(screen.queryByText(/unresponsive/i)).not.toBeInTheDocument();
    });

    it('clears unresponsive flag when stream event arrives', () => {
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'invoking', detail: 'Sonnet', timestamp: Date.now() },
        isConnected: true,
      };

      const { rerender } = render(<PipelineActivity threadId='thread-1' isActive={true} />);

      // Go past threshold
      act(() => vi.advanceTimersByTime(65_000));
      expect(screen.getByText(/unresponsive/i)).toBeInTheDocument();

      // Now a stream event arrives — should clear the flag
      wsOverrides['pipeline:stream'] = {
        lastEvent: { threadId: 'thread-1', event: { type: 'tool_call', toolName: 'Read', timestamp: Date.now() } },
        isConnected: true,
      };
      rerender(<PipelineActivity threadId='thread-1' isActive={true} />);

      expect(screen.queryByText(/unresponsive/i)).not.toBeInTheDocument();
    });

    it('ignores stream events from other threads for heartbeat reset', () => {
      wsOverrides['pipeline:step'] = {
        lastEvent: { threadId: 'thread-1', step: 'invoking', detail: 'Sonnet', timestamp: Date.now() },
        isConnected: true,
      };
      // Stream event from a DIFFERENT thread — should NOT reset timer
      wsOverrides['pipeline:stream'] = {
        lastEvent: { threadId: 'thread-other', event: { type: 'thinking', content: 'reasoning...', timestamp: Date.now() } },
        isConnected: true,
      };

      render(<PipelineActivity threadId='thread-1' isActive={true} />);

      act(() => vi.advanceTimersByTime(65_000));

      expect(screen.getByText(/unresponsive/i)).toBeInTheDocument();
    });
  });
});
