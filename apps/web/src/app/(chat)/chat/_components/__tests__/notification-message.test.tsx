import { render, screen } from '@testing-library/react';
import type { Message } from 'database';
import { describe, expect, it } from 'vitest';
import type { CrossThreadMetadata } from '../../_helpers/is-cross-thread-notification';
import { NotificationMessage } from '../notification-message';

type NotificationMsg = Message & { metadata: CrossThreadMetadata };

type MakeNotificationOverrides = Omit<Partial<NotificationMsg>, 'metadata'> & { metadata?: Partial<CrossThreadMetadata> };

type MakeNotification = (overrides?: MakeNotificationOverrides) => NotificationMsg;

const makeNotification: MakeNotification = (overrides) => {
  const { metadata: metaOverrides, ...rest } = overrides ?? {};
  return {
    id: 'msg-1',
    threadId: 'parent-thread-1',
    role: 'system',
    content: 'Task completed after 2 iteration(s): All tests pass.',
    model: null,
    createdAt: new Date('2025-01-15T12:00:00Z'),
    ...rest,
    metadata: {
      type: 'cross-thread-notification',
      sourceThreadId: 'task-thread-1',
      taskId: 'task-1',
      status: 'completed',
      iterations: 2,
      ...metaOverrides,
    },
  } as NotificationMsg;
};

describe('NotificationMessage', () => {
  it('renders completed task status label', () => {
    const message = makeNotification();
    render(<NotificationMessage message={message} />);
    expect(screen.getByText('Task completed')).toBeInTheDocument();
  });

  it('renders failed task status label', () => {
    const message = makeNotification({
      content: 'Task failed after 5 iteration(s): Max iterations exhausted',
      metadata: { status: 'failed', iterations: 5 },
    });
    render(<NotificationMessage message={message} />);
    expect(screen.getByText('Task failed')).toBeInTheDocument();
  });

  it('renders the message content', () => {
    const message = makeNotification({ content: 'Task completed after 2 iteration(s): All tests pass.' });
    render(<NotificationMessage message={message} />);
    expect(screen.getByText('Task completed after 2 iteration(s): All tests pass.')).toBeInTheDocument();
  });

  it('renders iteration count', () => {
    const message = makeNotification();
    render(<NotificationMessage message={message} />);
    expect(screen.getByText('2 iterations')).toBeInTheDocument();
  });

  it('renders singular iteration for count of 1', () => {
    const message = makeNotification({ metadata: { iterations: 1 } });
    render(<NotificationMessage message={message} />);
    expect(screen.getByText('1 iteration')).toBeInTheDocument();
  });

  it('renders a View thread link pointing to the source thread', () => {
    const message = makeNotification({ metadata: { sourceThreadId: 'task-thread-abc' } });
    render(<NotificationMessage message={message} />);

    const link = screen.getByRole('link', { name: /view thread/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/chat/task-thread-abc');
  });

  it('renders green styling for completed tasks', () => {
    const message = makeNotification();
    const { container } = render(<NotificationMessage message={message} />);

    // The outer banner div should have green border classes
    const banner = container.querySelector("[class*='border-green']");
    expect(banner).toBeTruthy();
  });

  it('renders red styling for failed tasks', () => {
    const message = makeNotification({ metadata: { status: 'failed', iterations: 3 } });
    const { container } = render(<NotificationMessage message={message} />);

    // The outer banner div should have red border classes
    const banner = container.querySelector("[class*='border-red']");
    expect(banner).toBeTruthy();
  });
});
