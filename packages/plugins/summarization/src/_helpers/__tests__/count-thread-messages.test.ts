import type { PrismaClient } from '@harness/database';
import { describe, expect, it, vi } from 'vitest';
import { countThreadMessages } from '../count-thread-messages';

type MockDb = Pick<PrismaClient, 'message'>;

const createMockDb = (count: number): MockDb =>
  ({
    message: {
      count: vi.fn().mockResolvedValue(count),
    },
  }) as unknown as MockDb;

describe('countThreadMessages', () => {
  it('returns the count from db.message.count with kind=text filter', async () => {
    const db = createMockDb(42);

    const result = await countThreadMessages(db as unknown as PrismaClient, 'thread-1');

    expect(result).toBe(42);
    expect(db.message.count).toHaveBeenCalledWith({
      where: { threadId: 'thread-1', kind: 'text' },
    });
  });

  it('returns 0 when the thread has no text messages', async () => {
    const db = createMockDb(0);

    const result = await countThreadMessages(db as unknown as PrismaClient, 'thread-empty');

    expect(result).toBe(0);
  });

  it('passes the correct threadId to the query', async () => {
    const db = createMockDb(5);

    const result = await countThreadMessages(db as unknown as PrismaClient, 'my-thread-id');

    expect(result).toBe(5);
    expect(db.message.count).toHaveBeenCalledWith({
      where: { threadId: 'my-thread-id', kind: 'text' },
    });
  });
});
