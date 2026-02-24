// Session pool — manages a Map of warm Agent SDK sessions keyed by thread ID
// Sessions are proactively evicted after a TTL to avoid stale-session errors

import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

export type SendOptions = {
  onMessage?: (message: SDKMessage) => void;
};

export type Session = {
  send: (prompt: string, options?: SendOptions) => Promise<SDKResultMessage>;
  close: () => void;
  isAlive: boolean;
  lastActivity: number;
};

export type SessionFactory = (model: string) => Session;

export type SessionPoolConfig = {
  maxSessions: number;
  ttlMs: number;
};

export type SessionPool = {
  get: (threadId: string, model: string) => Session;
  evict: (threadId: string) => void;
  closeAll: () => void;
  size: () => number;
};

type CreateSessionPool = (config: SessionPoolConfig, factory: SessionFactory) => SessionPool;

export const createSessionPool: CreateSessionPool = (config, factory) => {
  const sessions = new Map<string, { session: Session; model: string }>();
  let evictionTimer: ReturnType<typeof setInterval> | null = null;

  const startEvictionTimer = () => {
    if (evictionTimer) {
      return;
    }
    evictionTimer = setInterval(() => {
      const now = Date.now();
      for (const [threadId, entry] of sessions) {
        if (!entry.session.isAlive || now - entry.session.lastActivity > config.ttlMs) {
          entry.session.close();
          sessions.delete(threadId);
        }
      }
      if (sessions.size === 0 && evictionTimer) {
        clearInterval(evictionTimer);
        evictionTimer = null;
      }
    }, 60_000);
  };

  const evictOldest = () => {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;
    for (const [threadId, entry] of sessions) {
      if (entry.session.lastActivity < oldestTime) {
        oldestTime = entry.session.lastActivity;
        oldestKey = threadId;
      }
    }
    if (oldestKey) {
      const entry = sessions.get(oldestKey);
      entry?.session.close();
      sessions.delete(oldestKey);
    }
  };

  const get = (threadId: string, model: string): Session => {
    const existing = sessions.get(threadId);

    if (existing?.session.isAlive && existing.model === model) {
      return existing.session;
    }

    // Close stale or model-mismatched session
    if (existing) {
      existing.session.close();
      sessions.delete(threadId);
    }

    // Evict oldest if at capacity
    if (sessions.size >= config.maxSessions) {
      evictOldest();
    }

    const session = factory(model);
    sessions.set(threadId, { session, model });
    startEvictionTimer();
    return session;
  };

  const evict = (threadId: string) => {
    const entry = sessions.get(threadId);
    if (entry) {
      entry.session.close();
      sessions.delete(threadId);
    }
  };

  const closeAll = () => {
    if (evictionTimer) {
      clearInterval(evictionTimer);
      evictionTimer = null;
    }
    for (const [, entry] of sessions) {
      entry.session.close();
    }
    sessions.clear();
  };

  return {
    get,
    evict,
    closeAll,
    size: () => sessions.size,
  };
};
