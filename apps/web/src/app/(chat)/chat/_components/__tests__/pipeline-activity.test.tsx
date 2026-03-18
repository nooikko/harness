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
});
