import type { Thread } from 'database';
import { describe, expect, it } from 'vitest';
import { sortThreads } from '../sort-threads';

type MakeThread = (overrides: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-1',
  source: 'web',
  sourceId: 'session-1',
  name: null,
  kind: 'general',
  status: 'open',
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('sortThreads', () => {
  it('returns an empty array for empty input', () => {
    expect(sortThreads([])).toEqual([]);
  });

  it('pins primary thread to the top', () => {
    const general = makeThread({ id: 'general-1', kind: 'general', lastActivity: new Date('2025-01-20T00:00:00Z') });
    const primary = makeThread({ id: 'primary-1', kind: 'primary', lastActivity: new Date('2025-01-10T00:00:00Z') });
    const task = makeThread({ id: 'task-1', kind: 'task', lastActivity: new Date('2025-01-15T00:00:00Z') });

    const result = sortThreads([general, primary, task]);

    expect(result[0]?.id).toBe('primary-1');
  });

  it('sorts non-primary threads by lastActivity descending', () => {
    const old = makeThread({ id: 'old', kind: 'general', lastActivity: new Date('2025-01-01T00:00:00Z') });
    const mid = makeThread({ id: 'mid', kind: 'task', lastActivity: new Date('2025-01-10T00:00:00Z') });
    const recent = makeThread({ id: 'recent', kind: 'cron', lastActivity: new Date('2025-01-20T00:00:00Z') });

    const result = sortThreads([old, mid, recent]);

    expect(result.map((t) => t.id)).toEqual(['recent', 'mid', 'old']);
  });

  it('places primary before more recent non-primary threads', () => {
    const primary = makeThread({ id: 'primary', kind: 'primary', lastActivity: new Date('2025-01-01T00:00:00Z') });
    const recent = makeThread({ id: 'recent', kind: 'general', lastActivity: new Date('2025-02-01T00:00:00Z') });

    const result = sortThreads([recent, primary]);

    expect(result[0]?.id).toBe('primary');
    expect(result[1]?.id).toBe('recent');
  });

  it('handles multiple primary threads', () => {
    const primary1 = makeThread({ id: 'p1', kind: 'primary', lastActivity: new Date('2025-01-01T00:00:00Z') });
    const primary2 = makeThread({ id: 'p2', kind: 'primary', lastActivity: new Date('2025-01-02T00:00:00Z') });
    const general = makeThread({ id: 'g1', kind: 'general', lastActivity: new Date('2025-02-01T00:00:00Z') });

    const result = sortThreads([general, primary1, primary2]);

    expect(result[0]?.kind).toBe('primary');
    expect(result[1]?.kind).toBe('primary');
    expect(result[2]?.kind).toBe('general');
  });

  it('preserves all threads without losing any', () => {
    const threads = [
      makeThread({ id: 'a', kind: 'general' }),
      makeThread({ id: 'b', kind: 'primary' }),
      makeThread({ id: 'c', kind: 'task' }),
      makeThread({ id: 'd', kind: 'cron' }),
    ];

    const result = sortThreads(threads);

    expect(result).toHaveLength(4);
    expect(new Set(result.map((t) => t.id))).toEqual(new Set(['a', 'b', 'c', 'd']));
  });
});
