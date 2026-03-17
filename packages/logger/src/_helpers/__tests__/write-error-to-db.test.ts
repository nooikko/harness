import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeErrorToDb } from '../write-error-to-db';

describe('writeErrorToDb', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an ErrorLog record with all fields', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'log_1' });
    const db = { errorLog: { create: createMock } };

    writeErrorToDb({
      db,
      level: 'error',
      source: 'orchestrator',
      message: 'Something broke',
      stack: 'Error: Something broke\n  at foo.ts:1',
      traceId: 'trace-abc',
      threadId: 'thread-123',
      metadata: { extra: 'info' },
    });

    // Wait for the void async IIFE to complete
    await vi.waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    expect(createMock).toHaveBeenCalledWith({
      data: {
        level: 'error',
        source: 'orchestrator',
        message: 'Something broke',
        stack: 'Error: Something broke\n  at foo.ts:1',
        traceId: 'trace-abc',
        threadId: 'thread-123',
        metadata: { extra: 'info' },
      },
    });
  });

  it('works with minimal params (level, source, message only)', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'log_2' });
    const db = { errorLog: { create: createMock } };

    writeErrorToDb({
      db,
      level: 'warn',
      source: 'web',
      message: 'Minor issue',
    });

    await vi.waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    expect(createMock).toHaveBeenCalledWith({
      data: {
        level: 'warn',
        source: 'web',
        message: 'Minor issue',
      },
    });
  });

  it('does not throw when db.errorLog.create fails', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const createMock = vi.fn().mockRejectedValue(new Error('DB connection refused'));
    const db = { errorLog: { create: createMock } };

    // Should not throw
    writeErrorToDb({
      db,
      level: 'error',
      source: 'cron',
      message: 'Task failed',
    });

    await vi.waitFor(() => expect(stderrSpy).toHaveBeenCalledTimes(1));

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('DB connection refused'));
  });

  it('does not block the caller (returns synchronously)', () => {
    const createMock = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ id: 'log_3' }), 1000)));
    const db = { errorLog: { create: createMock } };

    const start = Date.now();
    writeErrorToDb({
      db,
      level: 'error',
      source: 'test',
      message: 'slow write',
    });
    const elapsed = Date.now() - start;

    // Should return in under 50ms (synchronous return)
    expect(elapsed).toBeLessThan(50);
  });
});
