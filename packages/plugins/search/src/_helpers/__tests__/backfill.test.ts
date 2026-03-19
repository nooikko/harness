import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfill } from '../backfill';

vi.mock('../index-message', () => ({
  indexMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../index-thread', () => ({
  indexThread: vi.fn().mockResolvedValue(undefined),
}));

const { indexMessage } = await import('../index-message');
const { indexThread } = await import('../index-thread');

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
});

const createMockDb = (messages: Array<{ id: string }> = [], threads: Array<{ id: string }> = []) => {
  let msgCall = 0;
  let threadCall = 0;
  return {
    message: {
      findMany: vi.fn().mockImplementation(() => {
        const result = msgCall === 0 ? messages : [];
        msgCall++;
        return Promise.resolve(result);
      }),
    },
    thread: {
      findMany: vi.fn().mockImplementation(() => {
        const result = threadCall === 0 ? threads : [];
        threadCall++;
        return Promise.resolve(result);
      }),
    },
  };
};

const createMultiBatchMockDb = (messageBatches: Array<Array<{ id: string }>>, threadBatches: Array<Array<{ id: string }>>) => {
  let msgCall = 0;
  let threadCall = 0;
  return {
    message: {
      findMany: vi.fn().mockImplementation(() => {
        const result = messageBatches[msgCall] ?? [];
        msgCall++;
        return Promise.resolve(result);
      }),
    },
    thread: {
      findMany: vi.fn().mockImplementation(() => {
        const result = threadBatches[threadCall] ?? [];
        threadCall++;
        return Promise.resolve(result);
      }),
    },
  };
};

const createMockQdrant = (messagesCount = 0, threadsCount = 0) => ({
  getCollection: vi.fn().mockImplementation((name: string) => {
    if (name === 'messages') {
      return Promise.resolve({ points_count: messagesCount });
    }
    return Promise.resolve({ points_count: threadsCount });
  }),
});

describe('backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips backfill when both collections already have data', async () => {
    const qdrant = createMockQdrant(100, 50);
    const db = createMockDb();
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('skipping backfill'));
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it('indexes messages and threads when both collections are empty', async () => {
    const qdrant = createMockQdrant(0, 0);
    const db = createMockDb([{ id: 'm1' }, { id: 'm2' }], [{ id: 't1' }]);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(2);
    expect(indexThread).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2 messages, 1 threads'));
  });

  it('runs backfill when points_count is null', async () => {
    const qdrant = {
      getCollection: vi.fn().mockResolvedValue({ points_count: null }),
    };
    const db = createMockDb([], []);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Backfill complete'));
  });

  it('continues past individual indexing failures', async () => {
    const qdrant = createMockQdrant(0, 0);
    const db = createMockDb([{ id: 'm1' }, { id: 'm2' }], []);
    const logger = createMockLogger();

    vi.mocked(indexMessage).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 messages'));
  });

  it('handles thread indexing failures gracefully', async () => {
    const qdrant = createMockQdrant(0, 0);
    const db = createMockDb([], [{ id: 't1' }]);
    const logger = createMockLogger();

    vi.mocked(indexThread).mockRejectedValueOnce(new Error('fail'));

    await backfill(qdrant as never, db as never, logger);

    expect(indexThread).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('0 threads'));
  });

  it('skips messages but backfills threads when only messages have data', async () => {
    const qdrant = createMockQdrant(100, 0);
    const db = createMockDb([], [{ id: 't1' }]);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(db.message.findMany).not.toHaveBeenCalled();
    expect(indexThread).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('0 messages, 1 threads'));
  });

  it('skips threads but backfills messages when only threads have data', async () => {
    const qdrant = createMockQdrant(0, 50);
    const db = createMockDb([{ id: 'm1' }], []);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(1);
    expect(db.thread.findMany).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 messages, 0 threads'));
  });

  it('stops processing when abort signal fires', async () => {
    const qdrant = createMockQdrant(0, 0);
    const controller = new AbortController();
    // Abort immediately
    controller.abort();
    const db = createMockDb([{ id: 'm1' }], [{ id: 't1' }]);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger, controller.signal);

    // Should not process any items since signal is already aborted
    expect(indexMessage).not.toHaveBeenCalled();
    expect(indexThread).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Backfill aborted'));
  });

  it('processes multiple batches with correct offset progression', async () => {
    const qdrant = createMockQdrant(0, 0);
    const batch1 = Array.from({ length: 3 }, (_, i) => ({ id: `m${i}` }));
    const batch2 = Array.from({ length: 2 }, (_, i) => ({ id: `m${i + 3}` }));
    const db = createMultiBatchMockDb([batch1, batch2, []], [[]]);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(5);
    // Verify offset progression: skip=0, skip=3, skip=5
    expect(db.message.findMany).toHaveBeenCalledTimes(3);
    expect(db.message.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 0 }));
    expect(db.message.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ skip: 3 }));
    expect(db.message.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({ skip: 5 }));
  });

  it('stops mid-batch when abort signal fires during processing', async () => {
    const qdrant = createMockQdrant(0, 0);
    const controller = new AbortController();
    const db = createMockDb([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], []);
    const logger = createMockLogger();

    // Abort after the first indexMessage call
    vi.mocked(indexMessage).mockImplementation(async () => {
      controller.abort();
    });

    await backfill(qdrant as never, db as never, logger, controller.signal);

    // Should have called indexMessage once (first item), then aborted before m2/m3
    expect(indexMessage).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Backfill aborted'));
  });
});
