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

describe('backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips backfill when collections already have data', async () => {
    const qdrant = { getCollection: vi.fn().mockResolvedValue({ points_count: 100 }) };
    const db = createMockDb();
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('skipping backfill'));
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it('indexes messages and threads when collections are empty', async () => {
    const qdrant = { getCollection: vi.fn().mockResolvedValue({ points_count: 0 }) };
    const db = createMockDb([{ id: 'm1' }, { id: 'm2' }], [{ id: 't1' }]);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(2);
    expect(indexThread).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('2 messages, 1 threads'));
  });

  it('runs backfill when points_count is null', async () => {
    const qdrant = { getCollection: vi.fn().mockResolvedValue({ points_count: null }) };
    const db = createMockDb([], []);
    const logger = createMockLogger();

    await backfill(qdrant as never, db as never, logger);

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Backfill complete'));
  });

  it('continues past individual indexing failures', async () => {
    const qdrant = { getCollection: vi.fn().mockResolvedValue({ points_count: 0 }) };
    const db = createMockDb([{ id: 'm1' }, { id: 'm2' }], []);
    const logger = createMockLogger();

    vi.mocked(indexMessage).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined);

    await backfill(qdrant as never, db as never, logger);

    expect(indexMessage).toHaveBeenCalledTimes(2);
    // Only 1 succeeded
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('1 messages'));
  });

  it('handles thread indexing failures gracefully', async () => {
    const qdrant = { getCollection: vi.fn().mockResolvedValue({ points_count: 0 }) };
    const db = createMockDb([], [{ id: 't1' }]);
    const logger = createMockLogger();

    vi.mocked(indexThread).mockRejectedValueOnce(new Error('fail'));

    await backfill(qdrant as never, db as never, logger);

    expect(indexThread).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('0 threads'));
  });
});
