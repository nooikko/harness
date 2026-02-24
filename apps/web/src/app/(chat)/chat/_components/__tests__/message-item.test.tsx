import { render, screen } from '@testing-library/react';
import type { Message } from 'database';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../_helpers/is-cross-thread-notification', () => ({
  isCrossThreadNotification: (msg: Message) => (msg.metadata as Record<string, unknown>)?.crossThread === true,
}));

vi.mock('../notification-message', () => ({
  NotificationMessage: ({ message }: { message: Message }) => <div data-testid='notification'>{message.content}</div>,
}));

vi.mock('../../_helpers/format-model-name', () => ({
  formatModelName: (model: string) => model.replace('claude-', '').split('-')[0],
}));

import { MessageItem } from '../message-item';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'user',
  content: 'Hello',
  model: null,
  metadata: null,
  createdAt: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
});

describe('MessageItem', () => {
  it('renders user message with user styling', () => {
    render(<MessageItem message={makeMessage({ role: 'user' })} />);
    expect(screen.getByLabelText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders assistant message with assistant styling', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Hi there' })} />);
    expect(screen.getByLabelText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('renders system message with system styling', () => {
    render(<MessageItem message={makeMessage({ role: 'system', content: 'System info' })} />);
    expect(screen.getByLabelText('System')).toBeInTheDocument();
    expect(screen.getByText('System info')).toBeInTheDocument();
  });

  it('falls back to system config for unknown role', () => {
    render(<MessageItem message={makeMessage({ role: 'unknown', content: 'Fallback' })} />);
    expect(screen.getByLabelText('System')).toBeInTheDocument();
  });

  it('renders cross-thread notification as NotificationMessage', () => {
    render(
      <MessageItem
        message={makeMessage({
          metadata: { crossThread: true },
          content: 'Task done',
        })}
      />,
    );
    expect(screen.getByTestId('notification')).toBeInTheDocument();
    expect(screen.getByText('Task done')).toBeInTheDocument();
  });

  it('shows model badge on assistant messages when model is set', () => {
    render(
      <MessageItem
        message={makeMessage({
          role: 'assistant',
          content: 'Response',
          model: 'claude-sonnet-4-6',
        })}
      />,
    );
    expect(screen.getByText('sonnet')).toBeInTheDocument();
  });

  it('does not show model badge on user messages', () => {
    render(
      <MessageItem
        message={makeMessage({
          role: 'user',
          content: 'Hi',
          model: 'claude-sonnet-4-6',
        })}
      />,
    );
    expect(screen.queryByText('sonnet')).not.toBeInTheDocument();
  });

  it('does not show model badge when model is null', () => {
    render(
      <MessageItem
        message={makeMessage({
          role: 'assistant',
          content: 'Response',
          model: null,
        })}
      />,
    );
    const badges = document.querySelectorAll('.text-\\[10px\\]');
    expect(badges.length).toBe(0);
  });
});
