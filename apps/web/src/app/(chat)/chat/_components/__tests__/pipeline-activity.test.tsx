import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUseWs = vi.fn().mockReturnValue({ lastEvent: null, isConnected: true });
vi.mock('@/app/_components/ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...args),
}));

const { PipelineActivity } = await import('../pipeline-activity');

describe('PipelineActivity', () => {
  it('renders nothing when not active', () => {
    const { container } = render(<PipelineActivity threadId='thread-1' isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows thinking indicator when active with no events', () => {
    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('shows pipeline steps as they arrive', () => {
    mockUseWs.mockReturnValue({
      lastEvent: {
        threadId: 'thread-1',
        step: 'invoking',
        detail: 'Sonnet',
        timestamp: Date.now(),
      },
      isConnected: true,
    });

    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(screen.getAllByText(/calling claude/i).length).toBeGreaterThan(0);
  });

  it('ignores pipeline steps for other threads', () => {
    mockUseWs.mockReturnValue({
      lastEvent: {
        threadId: 'thread-other',
        step: 'invoking',
        detail: 'Sonnet',
        timestamp: Date.now(),
      },
      isConnected: true,
    });

    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    // Should show Thinking but NOT the step detail for other thread
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    expect(screen.queryByText(/sonnet/i)).not.toBeInTheDocument();
  });

  it('subscribes to pipeline:step events', () => {
    render(<PipelineActivity threadId='thread-1' isActive={true} />);
    expect(mockUseWs).toHaveBeenCalledWith('pipeline:step');
  });
});
