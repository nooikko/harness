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

vi.mock('../markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid='markdown-content'>{content}</div>,
}));

vi.mock('../activity-chips', () => ({
  ActivityChips: ({
    model,
    inputTokens,
    outputTokens,
    durationMs,
  }: {
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
  }) => (
    <div
      data-testid='activity-chips'
      data-model={model ?? ''}
      data-input-tokens={inputTokens ?? ''}
      data-output-tokens={outputTokens ?? ''}
      data-duration-ms={durationMs ?? ''}
    />
  ),
}));

import type { MessageItemProps } from '../message-item';
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

const makeAgentRun = (): MessageItemProps['agentRun'] => ({
  model: 'claude-sonnet-4-6',
  inputTokens: 500,
  outputTokens: 200,
  durationMs: 1500,
});

describe('MessageItem', () => {
  it('renders user message with user styling', () => {
    render(<MessageItem message={makeMessage({ role: 'user' })} />);
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders assistant message with assistant styling', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Hi there' })} />);
    expect(screen.getByLabelText('Assistant')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Hi there');
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

  it('shows model badge on assistant messages when model is set and no agentRun', () => {
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
    expect(screen.queryByTestId('activity-chips')).not.toBeInTheDocument();
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
    expect(screen.queryByText('sonnet')).not.toBeInTheDocument();
    expect(screen.queryByText(/model/i)).not.toBeInTheDocument();
  });

  it('renders assistant messages with MarkdownContent', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: '**bold** text' })} />);
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('**bold** text');
  });

  it('renders user messages as plain text without MarkdownContent', () => {
    render(<MessageItem message={makeMessage({ role: 'user', content: 'Hello' })} />);
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders ActivityChips when agentRun is provided for assistant message', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Response' })} agentRun={makeAgentRun()} />);
    const chips = screen.getByTestId('activity-chips');
    expect(chips).toBeInTheDocument();
    expect(chips).toHaveAttribute('data-model', 'claude-sonnet-4-6');
    expect(chips).toHaveAttribute('data-input-tokens', '500');
    expect(chips).toHaveAttribute('data-output-tokens', '200');
    expect(chips).toHaveAttribute('data-duration-ms', '1500');
  });

  it('replaces model badge with ActivityChips when agentRun is provided', () => {
    render(
      <MessageItem
        message={makeMessage({
          role: 'assistant',
          content: 'Response',
          model: 'claude-sonnet-4-6',
        })}
        agentRun={makeAgentRun()}
      />,
    );
    expect(screen.getByTestId('activity-chips')).toBeInTheDocument();
    // The old static model badge should NOT render
    expect(screen.queryByText('sonnet')).not.toBeInTheDocument();
  });

  it('does not render ActivityChips for user messages even if agentRun is provided', () => {
    render(<MessageItem message={makeMessage({ role: 'user', content: 'Hello' })} agentRun={makeAgentRun()} />);
    expect(screen.queryByTestId('activity-chips')).not.toBeInTheDocument();
  });

  it('does not render ActivityChips when agentRun is undefined', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Hi' })} />);
    expect(screen.queryByTestId('activity-chips')).not.toBeInTheDocument();
  });
});
