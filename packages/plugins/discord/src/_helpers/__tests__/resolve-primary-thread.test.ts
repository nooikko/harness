import type { PrismaClient } from '@harness/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCache, resolvePrimaryThread } from '../resolve-primary-thread';

type MockDb = {
  thread: { findFirst: ReturnType<typeof vi.fn> };
};

const makeDb = (): MockDb => ({
  thread: {
    findFirst: vi.fn().mockResolvedValue({ id: 'primary-thread-1' }),
  },
});

describe('resolvePrimaryThread', () => {
  beforeEach(() => {
    resetCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the primary thread when it exists', async () => {
    const db = makeDb();
    const result = await resolvePrimaryThread(db as unknown as PrismaClient);

    expect(result).toEqual({ id: 'primary-thread-1' });
    expect(db.thread.findFirst).toHaveBeenCalledWith({
      where: { kind: 'primary' },
      select: { id: true },
    });
  });

  it('returns null when no primary thread exists', async () => {
    const db = makeDb();
    db.thread.findFirst.mockResolvedValue(null);

    const result = await resolvePrimaryThread(db as unknown as PrismaClient);

    expect(result).toBeNull();
  });

  it('caches the result within the TTL', async () => {
    const db = makeDb();

    const first = await resolvePrimaryThread(db as unknown as PrismaClient);
    const second = await resolvePrimaryThread(db as unknown as PrismaClient);

    expect(first).toEqual({ id: 'primary-thread-1' });
    expect(second).toEqual({ id: 'primary-thread-1' });
    expect(db.thread.findFirst).toHaveBeenCalledTimes(1);
  });

  it('re-queries after cache is reset', async () => {
    const db = makeDb();

    await resolvePrimaryThread(db as unknown as PrismaClient);
    expect(db.thread.findFirst).toHaveBeenCalledTimes(1);

    resetCache();
    db.thread.findFirst.mockResolvedValue({ id: 'primary-thread-2' });

    const result = await resolvePrimaryThread(db as unknown as PrismaClient);
    expect(result).toEqual({ id: 'primary-thread-2' });
    expect(db.thread.findFirst).toHaveBeenCalledTimes(2);
  });

  it('does not cache null results', async () => {
    const db = makeDb();
    db.thread.findFirst.mockResolvedValue(null);

    await resolvePrimaryThread(db as unknown as PrismaClient);
    db.thread.findFirst.mockResolvedValue({ id: 'primary-thread-1' });

    const result = await resolvePrimaryThread(db as unknown as PrismaClient);
    expect(result).toEqual({ id: 'primary-thread-1' });
    expect(db.thread.findFirst).toHaveBeenCalledTimes(2);
  });
});
