import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionFactory } from '../session-pool';
import { createSessionPool } from '../session-pool';

const createMockSession = (overrides?: Partial<Session>): Session => ({
  send: vi.fn().mockResolvedValue({ type: 'result', subtype: 'success' }),
  close: vi.fn(),
  isAlive: true,
  lastActivity: Date.now(),
  ...overrides,
});

const createMockFactory = (): { factory: SessionFactory; sessions: Session[] } => {
  const sessions: Session[] = [];
  const factory: SessionFactory = (_model) => {
    const session = createMockSession();
    sessions.push(session);
    return session;
  };
  return { factory, sessions };
};

describe('createSessionPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a new session when none exists for the thread', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    const session = pool.get('thread-1', 'haiku');

    expect(sessions).toHaveLength(1);
    expect(session).toBe(sessions[0]);
  });

  it('returns existing warm session for the same thread and model', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    const first = pool.get('thread-1', 'haiku');
    const second = pool.get('thread-1', 'haiku');

    expect(sessions).toHaveLength(1);
    expect(second).toBe(first);
  });

  it('creates a new session when the model changes for a thread', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    pool.get('thread-1', 'haiku');
    const second = pool.get('thread-1', 'sonnet');

    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(second).toBe(sessions[1]);
  });

  it('creates a new session when the existing one is dead', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    const first = pool.get('thread-1', 'haiku');
    // Simulate session death
    Object.defineProperty(first, 'isAlive', { value: false });
    const second = pool.get('thread-1', 'haiku');

    expect(sessions).toHaveLength(2);
    expect(second).toBe(sessions[1]);
  });

  it('evicts the oldest session when at max capacity', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 2, ttlMs: 480_000 }, factory);

    pool.get('thread-1', 'haiku');
    // Advance time so thread-1 is older
    vi.advanceTimersByTime(1000);
    pool.get('thread-2', 'haiku');
    vi.advanceTimersByTime(1000);

    // This should evict thread-1 (oldest)
    pool.get('thread-3', 'haiku');

    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(pool.size()).toBe(2);
  });

  it('evict removes and closes a specific session', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    pool.get('thread-1', 'haiku');
    pool.evict('thread-1');

    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(pool.size()).toBe(0);
  });

  it('evict does nothing for a non-existent thread', () => {
    const { factory } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    pool.evict('nonexistent');

    expect(pool.size()).toBe(0);
  });

  it('closeAll closes all sessions and clears the pool', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    pool.get('thread-1', 'haiku');
    pool.get('thread-2', 'sonnet');
    pool.closeAll();

    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(sessions[1]!.close).toHaveBeenCalled();
    expect(pool.size()).toBe(0);
  });

  it('eviction timer cleans up expired sessions', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 60_000 }, factory);

    pool.get('thread-1', 'haiku');

    // Advance past TTL + eviction interval
    vi.advanceTimersByTime(120_000);

    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(pool.size()).toBe(0);
  });

  it('eviction timer cleans up dead sessions', () => {
    const { factory, sessions } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 3, ttlMs: 480_000 }, factory);

    const session = pool.get('thread-1', 'haiku');
    Object.defineProperty(session, 'isAlive', { value: false });

    // Trigger eviction interval
    vi.advanceTimersByTime(60_000);

    expect(sessions[0]!.close).toHaveBeenCalled();
    expect(pool.size()).toBe(0);
  });

  it('reports correct size', () => {
    const { factory } = createMockFactory();
    const pool = createSessionPool({ maxSessions: 5, ttlMs: 480_000 }, factory);

    expect(pool.size()).toBe(0);
    pool.get('thread-1', 'haiku');
    expect(pool.size()).toBe(1);
    pool.get('thread-2', 'haiku');
    expect(pool.size()).toBe(2);
    pool.evict('thread-1');
    expect(pool.size()).toBe(1);
  });
});
