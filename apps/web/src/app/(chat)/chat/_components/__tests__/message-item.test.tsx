import type { Message } from '@harness/database';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../_helpers/is-cross-thread-notification', () => ({
  isCrossThreadNotification: (msg: Message) => (msg.metadata as Record<string, unknown>)?.crossThread === true,
}));

vi.mock('../notification-message', () => ({
  NotificationMessage: ({ message }: { message: Message }) => <div data-testid='notification'>{message.content}</div>,
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

vi.mock('../thinking-block', () => ({
  ThinkingBlock: ({ content }: { content: string }) => <div data-testid='thinking-block'>{content}</div>,
}));

vi.mock('../tool-call-block', () => ({
  ToolCallBlock: ({ content }: { content: string }) => <div data-testid='tool-call-block'>{content}</div>,
}));

vi.mock('../tool-result-block', () => ({
  ToolResultBlock: ({ content }: { content: string }) => <div data-testid='tool-result-block'>{content}</div>,
}));

vi.mock('../pipeline-step', () => ({
  PipelineStep: () => <div data-testid='pipeline-step' />,
}));

vi.mock('../status-line', () => ({
  StatusLine: ({ content }: { content: string }) => <div data-testid='status-line'>{content}</div>,
}));

import { MessageItem } from '../message-item';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'user',
  kind: 'text',
  source: 'builtin',
  content: 'Hello',
  metadata: null,
  createdAt: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
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

  it('renders assistant message without ActivityChips when no agentRun metadata', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', content: 'Hi' })} />);
    expect(screen.queryByTestId('activity-chips')).not.toBeInTheDocument();
  });

  it('renders ThinkingBlock for kind=thinking', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', kind: 'thinking', content: 'Analyzing...' })} />);
    expect(screen.getByTestId('thinking-block')).toBeInTheDocument();
  });

  it('renders ToolCallBlock for kind=tool_call', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', kind: 'tool_call', content: 'Read', metadata: { toolName: 'Read' } })} />);
    expect(screen.getByTestId('tool-call-block')).toBeInTheDocument();
  });

  it('renders ToolResultBlock for kind=tool_result', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', kind: 'tool_result', content: 'file contents' })} />);
    expect(screen.getByTestId('tool-result-block')).toBeInTheDocument();
  });

  it('renders PipelineStep for kind=pipeline_step', () => {
    render(
      <MessageItem
        message={makeMessage({ role: 'system', kind: 'pipeline_step', content: 'Processing message', metadata: { step: 'onMessage' } })}
      />,
    );
    expect(screen.getByTestId('pipeline-step')).toBeInTheDocument();
  });

  it('renders StatusLine for kind=status', () => {
    render(<MessageItem message={makeMessage({ role: 'system', kind: 'status', content: 'Pipeline completed' })} />);
    expect(screen.getByTestId('status-line')).toBeInTheDocument();
  });

  it('falls back to existing text rendering for kind=text', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', kind: 'text', content: 'response' })} />);
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
  });

  it('preserves article role for assistant text messages', () => {
    render(<MessageItem message={makeMessage({ role: 'assistant', kind: 'text' })} />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
