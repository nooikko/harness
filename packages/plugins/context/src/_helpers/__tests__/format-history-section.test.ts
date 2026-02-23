import { describe, expect, it } from 'vitest';
import { formatHistorySection } from '../format-history-section';

describe('formatHistorySection', () => {
  it('formats messages into labeled blocks', () => {
    const result = formatHistorySection({
      threadId: 'thread-1',
      messages: [
        { role: 'user', content: 'Hello', createdAt: new Date() },
        { role: 'assistant', content: 'Hi there', createdAt: new Date() },
      ],
    });

    expect(result).toContain('# Conversation History');
    expect(result).toContain('[user]: Hello');
    expect(result).toContain('[assistant]: Hi there');
  });

  it('returns empty string for no messages', () => {
    const result = formatHistorySection({
      threadId: 'thread-1',
      messages: [],
    });

    expect(result).toBe('');
  });

  it('separates messages with double newlines', () => {
    const result = formatHistorySection({
      threadId: 'thread-1',
      messages: [
        { role: 'user', content: 'First', createdAt: new Date() },
        { role: 'system', content: 'Second', createdAt: new Date() },
      ],
    });

    expect(result).toContain('[user]: First\n\n[system]: Second');
  });

  it('handles system role messages', () => {
    const result = formatHistorySection({
      threadId: 'thread-1',
      messages: [{ role: 'system', content: 'System message', createdAt: new Date() }],
    });

    expect(result).toContain('[system]: System message');
  });
});
