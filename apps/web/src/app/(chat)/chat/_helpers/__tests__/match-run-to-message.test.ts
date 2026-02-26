import type { AgentRun, Message } from 'database';
import { describe, expect, it } from 'vitest';
import { matchRunToMessage } from '../match-run-to-message';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'msg-1',
  threadId: 'thread-1',
  role: 'assistant',
  kind: 'text',
  source: 'builtin',
  content: 'Hello',
  model: null,
  metadata: null,
  createdAt: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
});

const makeRun = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: 'run-1',
  threadId: 'thread-1',
  taskId: null,
  model: 'claude-sonnet-4-6',
  inputTokens: 500,
  outputTokens: 200,
  costEstimate: 0.01,
  durationMs: 1500,
  status: 'completed',
  error: null,
  startedAt: new Date('2026-02-23T09:59:58Z'),
  completedAt: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
});

describe('matchRunToMessage', () => {
  it('returns undefined when runs array is empty', () => {
    const message = makeMessage();
    expect(matchRunToMessage(message, [])).toBeUndefined();
  });

  it('matches the closest run that started before the message', () => {
    const message = makeMessage({
      createdAt: new Date('2026-02-23T10:00:10Z'),
    });
    const runs = [
      makeRun({
        id: 'run-early',
        startedAt: new Date('2026-02-23T09:59:00Z'),
      }),
      makeRun({
        id: 'run-close',
        startedAt: new Date('2026-02-23T10:00:05Z'),
      }),
    ];
    const result = matchRunToMessage(message, runs);
    expect(result?.id).toBe('run-close');
  });

  it('ignores runs that started after the message', () => {
    const message = makeMessage({
      createdAt: new Date('2026-02-23T10:00:00Z'),
    });
    const runs = [
      makeRun({
        id: 'run-after',
        startedAt: new Date('2026-02-23T10:00:05Z'),
      }),
    ];
    expect(matchRunToMessage(message, runs)).toBeUndefined();
  });

  it('returns the run when startedAt equals createdAt', () => {
    const message = makeMessage({
      createdAt: new Date('2026-02-23T10:00:00Z'),
    });
    const runs = [
      makeRun({
        id: 'run-exact',
        startedAt: new Date('2026-02-23T10:00:00Z'),
      }),
    ];
    const result = matchRunToMessage(message, runs);
    expect(result?.id).toBe('run-exact');
  });

  it('picks the closest run among multiple valid candidates', () => {
    const message = makeMessage({
      createdAt: new Date('2026-02-23T10:00:10Z'),
    });
    const runs = [
      makeRun({
        id: 'run-1',
        startedAt: new Date('2026-02-23T09:59:00Z'),
      }),
      makeRun({
        id: 'run-2',
        startedAt: new Date('2026-02-23T10:00:00Z'),
      }),
      makeRun({
        id: 'run-3',
        startedAt: new Date('2026-02-23T10:00:08Z'),
      }),
    ];
    const result = matchRunToMessage(message, runs);
    expect(result?.id).toBe('run-3');
  });

  it('does not match runs from a different thread if passed by mistake', () => {
    const message = makeMessage({
      threadId: 'thread-1',
      createdAt: new Date('2026-02-23T10:00:10Z'),
    });
    const runs = [
      makeRun({
        id: 'run-other',
        threadId: 'thread-2',
        startedAt: new Date('2026-02-23T10:00:05Z'),
      }),
    ];
    // The function does not filter by threadId — caller is responsible.
    // It should still return the closest match.
    const result = matchRunToMessage(message, runs);
    expect(result?.id).toBe('run-other');
  });
});
