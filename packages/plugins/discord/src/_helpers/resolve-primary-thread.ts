// Resolve primary thread — finds the user's primary assistant thread with caching

import type { PrismaClient } from '@harness/database';

type PrimaryThread = { id: string } | null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: PrimaryThread = null;
let cachedAt = 0;

type ResolvePrimaryThread = (db: PrismaClient) => Promise<PrimaryThread>;

export const resolvePrimaryThread: ResolvePrimaryThread = async (db) => {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const thread = await db.thread.findFirst({
    where: { kind: 'primary' },
    select: { id: true },
  });

  if (thread) {
    cached = thread;
    cachedAt = now;
  }

  return thread;
};

type ResetCache = () => void;

export const resetCache: ResetCache = () => {
  cached = null;
  cachedAt = 0;
};
