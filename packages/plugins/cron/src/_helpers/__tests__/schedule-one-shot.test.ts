import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock croner — scheduleOneShot now uses Cron for future one-shots
const mockCronStop = vi.fn();

vi.mock('croner', () => {
  class MockCron {
    stop = mockCronStop;
    _handler: () => void;
    constructor(_date: Date, _opts: Record<string, unknown>, handler: () => void) {
      this._handler = handler;
      // Simulate croner calling the handler at the right time
      // For test purposes we just store it
    }
  }
  return { Cron: MockCron };
});

vi.mock('../resolve-or-create-thread', () => ({
  resolveOrCreateThread: vi.fn(),
}));

import { resolveOrCreateThread } from '../resolve-or-create-thread';
import { scheduleOneShot } from '../schedule-one-shot';

const mockResolveOrCreateThread = vi.mocked(resolveOrCreateThread);

type CreateMockContext = (overrides?: Partial<PluginContext>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      cronJob: {
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    } as never,
    invoker: { invoke: vi.fn() },
    config: {} as never,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    sendToThread: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    reportBackgroundError: vi.fn(),
    runBackground: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

describe('scheduleOneShot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: passthrough — return job.threadId when it is non-null,
    // mirroring the real resolveOrCreateThread behaviour for tests that
    // supply a concrete threadId.
    mockResolveOrCreateThread.mockImplementation((_db, job) => Promise.resolve(job.threadId as string));
  });

  afterEach(() => {
    vi.useRealTimers();
    mockResolveOrCreateThread.mockReset();
  });

  it('fires immediately when fireAt is in the past', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 60_000);

    scheduleOneShot(
      ctx,
      {
        id: 'job-1',
        name: 'Past Job',
        prompt: 'do it now',
        threadId: 'thread-1',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('in the past'));

    // Advance past the 0ms timeout
    await vi.advanceTimersByTimeAsync(0);

    expect(ctx.sendToThread).toHaveBeenCalledWith('thread-1', 'do it now');
  });

  it('returns a Cron handle for future fireAt without firing immediately', () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const futureDate = new Date(Date.now() + 10_000);

    const handle = scheduleOneShot(
      ctx,
      {
        id: 'job-2',
        name: 'Future Job',
        prompt: 'do it later',
        threadId: 'thread-2',
        agentId: 'agent-1',
        projectId: null,
        fireAt: futureDate,
      },
      cleanup,
    );

    // Should return a Cron handle, not fire immediately
    expect(handle).not.toBeNull();
    expect(ctx.sendToThread).not.toHaveBeenCalled();
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('firing in'));
  });

  it('deletes the job record after firing', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    scheduleOneShot(
      ctx,
      {
        id: 'job-3',
        name: 'Auto Delete Job',
        prompt: 'fire once',
        threadId: 'thread-3',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    const db = ctx.db as unknown as {
      cronJob: { delete: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.delete).toHaveBeenCalledWith({
      where: { id: 'job-3' },
    });
  });

  it('calls the cleanup callback after firing', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    scheduleOneShot(
      ctx,
      {
        id: 'job-4',
        name: 'Cleanup Job',
        prompt: 'fire',
        threadId: 'thread-4',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(cleanup).toHaveBeenCalledWith('job-4');
  });

  it('calls resolveOrCreateThread on fire when threadId is null', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1_000);

    mockResolveOrCreateThread.mockResolvedValueOnce('resolved-thread-id');

    scheduleOneShot(
      ctx,
      {
        id: 'job-5',
        name: 'Null Thread Job',
        prompt: 'fire',
        threadId: null,
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(mockResolveOrCreateThread).toHaveBeenCalledWith(ctx.db, expect.objectContaining({ id: 'job-5', threadId: null }));
    expect(ctx.sendToThread).toHaveBeenCalledWith('resolved-thread-id', 'fire');
  });

  it('skips job with no fireAt and logs a warning', () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();

    scheduleOneShot(
      ctx,
      {
        id: 'job-6',
        name: 'No FireAt',
        prompt: 'fire',
        threadId: 'thread-6',
        agentId: 'agent-1',
        projectId: null,
        fireAt: null,
      },
      cleanup,
    );

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('no fireAt'));
    expect(ctx.sendToThread).not.toHaveBeenCalled();
  });

  it('returns a Cron instance for future one-shots that can be stopped', () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const futureDate = new Date(Date.now() + 60_000);

    const handle = scheduleOneShot(
      ctx,
      {
        id: 'job-7',
        name: 'Clearable Job',
        prompt: 'fire',
        threadId: 'thread-7',
        agentId: 'agent-1',
        projectId: null,
        fireAt: futureDate,
      },
      cleanup,
    );

    expect(handle).not.toBeNull();
    // Should not throw
    handle!.stop();

    vi.advanceTimersByTime(60_000);

    expect(ctx.sendToThread).not.toHaveBeenCalled();
  });

  it('logs an error when sendToThread fails but still deletes the job', async () => {
    const ctx = createMockContext({
      sendToThread: vi.fn().mockRejectedValue(new Error('pipeline failed')),
    });
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    scheduleOneShot(
      ctx,
      {
        id: 'job-8',
        name: 'Error Job',
        prompt: 'fire',
        threadId: 'thread-8',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('pipeline failed'));

    const db = ctx.db as unknown as {
      cronJob: { delete: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.delete).toHaveBeenCalledWith({
      where: { id: 'job-8' },
    });
  });

  it('handles non-Error thrown by resolveOrCreateThread', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    mockResolveOrCreateThread.mockRejectedValueOnce('string error');

    scheduleOneShot(
      ctx,
      {
        id: 'job-non-error',
        name: 'Non Error',
        prompt: 'fire',
        threadId: 'thread-ne',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
    expect(ctx.sendToThread).not.toHaveBeenCalled();
  });

  it('logs error and returns early when resolveOrCreateThread throws an Error', async () => {
    const ctx = createMockContext();
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    mockResolveOrCreateThread.mockRejectedValueOnce(new Error('thread resolve failed'));

    scheduleOneShot(
      ctx,
      {
        id: 'job-resolve-err',
        name: 'Resolve Error',
        prompt: 'fire',
        threadId: 'thread-re',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to resolve thread for one-shot job'));
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('thread resolve failed'));
    expect(ctx.sendToThread).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('logs error when DB delete fails after firing', async () => {
    const db = {
      cronJob: {
        delete: vi.fn().mockRejectedValue(new Error('DB delete failed')),
      },
    };
    const ctx = createMockContext({ db: db as never });
    const cleanup = vi.fn();
    const pastDate = new Date(Date.now() - 1000);

    scheduleOneShot(
      ctx,
      {
        id: 'job-db-err',
        name: 'DB Error Job',
        prompt: 'fire',
        threadId: 'thread-de',
        agentId: 'agent-1',
        projectId: null,
        fireAt: pastDate,
      },
      cleanup,
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to delete one-shot job'));
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('DB delete failed'));
    // cleanup should still be called
    expect(cleanup).toHaveBeenCalledWith('job-db-err');
  });
});
