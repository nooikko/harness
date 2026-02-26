import type { Message } from 'database';
import { describe, expect, it } from 'vitest';
import { isCrossThreadNotification } from '../is-cross-thread-notification';

type MakeMessage = (overrides?: Partial<Message>) => Message;

const makeMessage: MakeMessage = (overrides) => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'user',
  kind: 'text',
  source: 'builtin',
  content: 'Hello',
  model: null,
  metadata: null,
  createdAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('isCrossThreadNotification', () => {
  it('returns true for a valid cross-thread notification message', () => {
    const message = makeMessage({
      role: 'system',
      metadata: {
        type: 'cross-thread-notification',
        sourceThreadId: 'task-thread-1',
        taskId: 'task-1',
        status: 'completed',
        iterations: 2,
      },
    });

    expect(isCrossThreadNotification(message)).toBe(true);
  });

  it('returns true for a failed cross-thread notification', () => {
    const message = makeMessage({
      role: 'system',
      metadata: {
        type: 'cross-thread-notification',
        sourceThreadId: 'task-thread-2',
        taskId: 'task-2',
        status: 'failed',
        iterations: 5,
      },
    });

    expect(isCrossThreadNotification(message)).toBe(true);
  });

  it('returns false for a regular user message', () => {
    const message = makeMessage({ role: 'user', content: 'Hello' });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a regular assistant message', () => {
    const message = makeMessage({ role: 'assistant', content: 'Hi there' });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a system message without metadata', () => {
    const message = makeMessage({ role: 'system', content: 'System event', metadata: null });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a system message with wrong metadata type', () => {
    const message = makeMessage({
      role: 'system',
      metadata: { type: 'other-type', sourceThreadId: 'abc' },
    });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a system message missing sourceThreadId', () => {
    const message = makeMessage({
      role: 'system',
      metadata: { type: 'cross-thread-notification', taskId: 'task-1' },
    });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a system message missing taskId', () => {
    const message = makeMessage({
      role: 'system',
      metadata: { type: 'cross-thread-notification', sourceThreadId: 'thread-1' },
    });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for a system message with empty metadata object', () => {
    const message = makeMessage({
      role: 'system',
      metadata: {},
    });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('returns false for non-system role even with valid metadata', () => {
    const message = makeMessage({
      role: 'user',
      metadata: {
        type: 'cross-thread-notification',
        sourceThreadId: 'task-thread-1',
        taskId: 'task-1',
        status: 'completed',
        iterations: 1,
      },
    });
    expect(isCrossThreadNotification(message)).toBe(false);
  });

  it('narrows the type when returning true', () => {
    const message = makeMessage({
      role: 'system',
      metadata: {
        type: 'cross-thread-notification',
        sourceThreadId: 'task-thread-1',
        taskId: 'task-1',
        status: 'completed',
        iterations: 3,
      },
    });

    if (isCrossThreadNotification(message)) {
      // TypeScript should allow access to metadata fields after narrowing
      expect(message.metadata.sourceThreadId).toBe('task-thread-1');
      expect(message.metadata.taskId).toBe('task-1');
      expect(message.metadata.status).toBe('completed');
      expect(message.metadata.iterations).toBe(3);
    }
  });
});
