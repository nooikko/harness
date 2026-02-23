import { render, screen } from '@testing-library/react';
import type { Message } from 'database';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../message-list';

type MakeMessage = (overrides: Partial<Message>) => Message;

const makeMessage: MakeMessage = (overrides) => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'user',
  content: 'Hello world',
  metadata: null,
  createdAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('MessageList', () => {
  it('shows empty state when no messages exist', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText('No messages in this thread yet.')).toBeInTheDocument();
  });

  it('renders user messages', () => {
    const messages = [makeMessage({ id: 'm1', role: 'user', content: 'What is the weather?' })];
    render(<MessageList messages={messages} />);
    expect(screen.getByText('What is the weather?')).toBeInTheDocument();
  });

  it('renders assistant messages', () => {
    const messages = [makeMessage({ id: 'm1', role: 'assistant', content: 'It is sunny today.' })];
    render(<MessageList messages={messages} />);
    expect(screen.getByText('It is sunny today.')).toBeInTheDocument();
  });

  it('renders system messages', () => {
    const messages = [makeMessage({ id: 'm1', role: 'system', content: 'Task completed.' })];
    render(<MessageList messages={messages} />);
    expect(screen.getByText('Task completed.')).toBeInTheDocument();
  });

  it('renders multiple messages in order', () => {
    const messages = [
      makeMessage({ id: 'm1', role: 'user', content: 'First message' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'Second message' }),
      makeMessage({ id: 'm3', role: 'user', content: 'Third message' }),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
    expect(screen.getByText('Third message')).toBeInTheDocument();
  });

  it('renders role labels for accessibility', () => {
    const messages = [
      makeMessage({ id: 'm1', role: 'user', content: 'User text' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'Bot text' }),
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByLabelText('You')).toBeInTheDocument();
    expect(screen.getByLabelText('Assistant')).toBeInTheDocument();
  });
});
