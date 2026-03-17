import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { ErrorDetailModal } = await import('../error-detail-modal');

const makeError = (overrides: Record<string, unknown> = {}) => ({
  id: 'err-1',
  level: 'error',
  source: 'music',
  message: 'Failed to play song',
  stack: 'Error: Failed\n  at playTrack (music.ts:42)',
  traceId: 'trace-abc',
  threadId: 'thread-1',
  metadata: { videoId: 'xyz' },
  createdAt: '2026-03-16T22:00:00.000Z',
  ...overrides,
});

describe('ErrorDetailModal', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorDetailModal error={null} open={true} onOpenChange={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders error message when open', () => {
    render(<ErrorDetailModal error={makeError()} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Failed to play song')).toBeInTheDocument();
  });

  it('renders stack trace', () => {
    render(<ErrorDetailModal error={makeError()} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/at playTrack/)).toBeInTheDocument();
  });

  it('renders source badge', () => {
    render(<ErrorDetailModal error={makeError()} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('music')).toBeInTheDocument();
  });

  it('renders thread link when threadId exists', () => {
    render(<ErrorDetailModal error={makeError()} open={true} onOpenChange={vi.fn()} />);
    const link = screen.getByText(/thread-1/);
    expect(link.closest('a')).toHaveAttribute('href', '/chat/thread-1');
  });

  it('renders metadata as JSON', () => {
    render(<ErrorDetailModal error={makeError()} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/"videoId"/)).toBeInTheDocument();
  });

  it('handles null stack gracefully', () => {
    render(<ErrorDetailModal error={makeError({ stack: null })} open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Failed to play song')).toBeInTheDocument();
  });

  it('handles null threadId gracefully', () => {
    render(<ErrorDetailModal error={makeError({ threadId: null })} open={true} onOpenChange={vi.fn()} />);
    expect(screen.queryByText(/View thread/)).not.toBeInTheDocument();
  });
});
