import { beforeEach, describe, expect, it, vi } from 'vitest';

// Captured instances so tests can inspect the handler and stop fn
const mockInstances: MockCronInstance[] = [];
// Controls whether the next MockCron constructor call should throw
let throwOnNextConstruct = false;
// Controls the initial nextRun() return value for new MockCron instances
let mockInitialNextRunValue: Date | null = new Date('2099-01-01T00:00:00Z');

type MockCronInstance = {
  stop: ReturnType<typeof vi.fn>;
  nextRun: ReturnType<typeof vi.fn>;
  _handler: () => Promise<void>;
};

vi.mock('../schedule-one-shot', () => ({
  scheduleOneShot: vi.fn().mockReturnValue({ stop: vi.fn(), nextRun: vi.fn().mockReturnValue(null) }),
}));

vi.mock('../resolve-or-create-thread', () => ({
  resolveOrCreateThread: vi.fn(),
}));

vi.mock('croner', () => {
  class MockCron {
    stop: ReturnType<typeof vi.fn>;
    nextRun: ReturnType<typeof vi.fn>;
    _handler: () => Promise<void>;

    constructor(_schedule: string, _opts: Record<string, unknown>, handler: () => Promise<void>) {
      if (throwOnNextConstruct) {
        throwOnNextConstruct = false;
        throw new Error('Invalid cron expression');
      }
      this.stop = vi.fn();
      this.nextRun = vi.fn().mockReturnValue(mockInitialNextRunValue);
      this._handler = handler;
      mockInstances.push(this as MockCronInstance);
    }
  }

  return { Cron: MockCron };
});

import type { PluginContext } from '@harness/plugin-contract';
import { createCronServer } from '../cron-server';
import { resolveOrCreateThread } from '../resolve-or-create-thread';
import { scheduleOneShot } from '../schedule-one-shot';

const mockScheduleOneShot = vi.mocked(scheduleOneShot);
const mockResolveOrCreateThread = vi.mocked(resolveOrCreateThread);

type CreateMockDb = (jobs: object[]) => {
  cronJob: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const createMockDb: CreateMockDb = (jobs) => ({
  cronJob: {
    findMany: vi.fn().mockResolvedValue(jobs),
    update: vi.fn().mockResolvedValue(undefined),
  },
});

type CreateMockContext = (overrides?: Partial<PluginContext>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: createMockDb([]) as never,
    invoker: { invoke: vi.fn() },
    config: {
      claudeModel: 'sonnet',
      databaseUrl: '',
      timezone: 'UTC',
      maxConcurrentAgents: 5,
      claudeTimeout: 30000,
      discordToken: undefined,
      discordChannelId: undefined,
      port: 3001,
      logLevel: 'info',
      uploadDir: '/tmp/uploads',
    } as never,
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

describe('createCronServer', () => {
  beforeEach(() => {
    mockInstances.length = 0;
    throwOnNextConstruct = false;
    mockInitialNextRunValue = new Date('2099-01-01T00:00:00Z');
    mockScheduleOneShot.mockReturnValue({ stop: vi.fn(), nextRun: vi.fn().mockReturnValue(null) } as never);
    // Default: resolve to the job's threadId (mirrors real behaviour for recurring jobs)
    mockResolveOrCreateThread.mockImplementation((_db, job) => Promise.resolve((job as { threadId: string }).threadId));
  });

  it('returns start and stop functions', () => {
    const server = createCronServer();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  it('start() queries enabled CronJobs from the database', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'do something',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(db.cronJob.findMany).toHaveBeenCalledWith({
      where: { enabled: true },
    });
  });

  it('start() schedules a Cron job for each enabled job with threadId', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Job A',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'do A',
        threadId: 'thread-a',
      },
      {
        id: 'job-2',
        name: 'Job B',
        schedule: '0 17 * * *',
        fireAt: null,
        prompt: 'do B',
        threadId: 'thread-b',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(mockInstances).toHaveLength(2);
  });

  it('start() schedules a croner job for a recurring job with null threadId (thread resolved lazily on trigger)', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'No Thread Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'do something',
        threadId: null,
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // The croner job is still registered — thread resolution happens lazily
    // inside the trigger handler via resolveOrCreateThread, not at schedule time
    expect(mockInstances).toHaveLength(1);
  });

  it('start() sets initial nextRunAt on the CronJob record', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(db.cronJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ nextRunAt: expect.any(Date) }),
      }),
    );
  });

  it('trigger handler calls sendToThread with the job prompt and threadId', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'run the task',
        threadId: 'thread-xyz',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }

    await instance._handler();

    expect(ctx.sendToThread).toHaveBeenCalledWith('thread-xyz', 'run the task');
  });

  it('trigger handler updates lastRunAt and nextRunAt after sendToThread', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // Clear calls from initial nextRunAt setup
    db.cronJob.update.mockClear();

    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }

    await instance._handler();

    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      },
    });
  });

  it('trigger handler still updates lastRunAt when sendToThread throws', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({
      db: db as never,
      sendToThread: vi.fn().mockRejectedValue(new Error('pipeline failed')),
    });

    const server = createCronServer();
    await server.start(ctx);

    db.cronJob.update.mockClear();

    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }

    await instance._handler();

    expect(ctx.reportBackgroundError).toHaveBeenCalledWith('cron-job:Test Job:send-to-thread', expect.any(Error));
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: expect.any(Date),
      },
    });
  });

  it('stop() calls stop() on all scheduled jobs', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Job A',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'a',
        threadId: 'thread-1',
      },
      {
        id: 'job-2',
        name: 'Job B',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'b',
        threadId: 'thread-2',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(mockInstances).toHaveLength(2);

    await server.stop();

    for (const instance of mockInstances) {
      expect(instance.stop).toHaveBeenCalledOnce();
    }
  });

  it('stop() before start() does not throw', async () => {
    const server = createCronServer();
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('logs an error and continues when Cron constructor throws', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Bad Job',
        schedule: 'invalid-cron-expression',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    // Signal the mock constructor to throw on the next call
    throwOnNextConstruct = true;

    const server = createCronServer();
    await server.start(ctx);

    expect(mockInstances).toHaveLength(0);
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid cron expression'));
  });

  it('logs a warning when the initial nextRunAt update fails', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    db.cronJob.update.mockRejectedValueOnce(new Error('DB write failed'));
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to set initial nextRunAt'));
  });

  it('logs an error when the timestamp update inside the trigger handler fails', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // First call (initial nextRunAt) already succeeded; reject the next one (trigger update)
    db.cronJob.update.mockRejectedValueOnce(new Error('trigger update failed'));

    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }

    await instance._handler();

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to update timestamps'));
  });

  it('handles nextRun() returning null during startup — writes null nextRunAt and logs never', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Finite Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    // Configure mock to return null from nextRun() from the start
    mockInitialNextRunValue = null;

    const server = createCronServer();
    await server.start(ctx);

    // Initial nextRunAt update should write null
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { nextRunAt: null },
    });
    // Logger should say 'never' since toISOString cannot be called on null
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringContaining('never'));
  });

  it('handles nextRun() returning null (job will not fire again)', async () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'One-shot Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // Override nextRun to return null after creation (simulates end of schedule)
    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }
    instance.nextRun.mockReturnValue(null);

    db.cronJob.update.mockClear();
    await instance._handler();

    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        lastRunAt: expect.any(Date),
        nextRunAt: null,
      },
    });
  });

  // --- One-shot job branch coverage ---

  it('start() delegates one-shot jobs to scheduleOneShot and stores the timer handle', async () => {
    const fireAt = new Date('2099-06-01T00:00:00Z');
    const jobs = [
      {
        id: 'os-1',
        name: 'One Shot Job',
        schedule: null,
        fireAt,
        prompt: 'fire once',
        threadId: 'thread-os',
        agentId: 'agent-1',
        projectId: null,
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // scheduleOneShot should have been called instead of Cron constructor
    expect(mockScheduleOneShot).toHaveBeenCalledWith(ctx, jobs[0], expect.any(Function));
    expect(mockInstances).toHaveLength(0); // no croner instances for one-shot
    // nextRunAt should be set to fireAt for admin UI
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'os-1' },
      data: { nextRunAt: fireAt },
    });
  });

  it('one-shot cleanup callback removes the timer from the internal map (via stop)', async () => {
    const fireAt = new Date('2099-06-01T00:00:00Z');
    const jobs = [
      {
        id: 'os-cleanup',
        name: 'Cleanup One Shot',
        schedule: null,
        fireAt,
        prompt: 'fire',
        threadId: 'thread-c',
        agentId: 'agent-1',
        projectId: null,
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    // Capture the cleanup callback passed to scheduleOneShot
    let capturedCleanup: ((jobId: string) => void) | undefined;
    mockScheduleOneShot.mockImplementation(((_ctx: unknown, _job: unknown, cleanup: (jobId: string) => void) => {
      capturedCleanup = cleanup;
      return { stop: vi.fn(), nextRun: vi.fn().mockReturnValue(null) };
    }) as never);

    const server = createCronServer();
    await server.start(ctx);

    // Simulate the one-shot firing and calling cleanup
    expect(capturedCleanup).toBeDefined();
    capturedCleanup!('os-cleanup');

    // stop() should not throw — the timer was already cleaned up
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it('skips invalid job with neither schedule nor fireAt and logs a warning', async () => {
    const jobs = [
      {
        id: 'os-no-fire',
        name: 'No FireAt One Shot',
        schedule: null,
        fireAt: null,
        prompt: 'fire',
        threadId: 'thread-nf',
        agentId: 'agent-1',
        projectId: null,
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    // validateCronJob returns invalid for schedule=null + fireAt=null, so it's skipped
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('skipping invalid job'));
    expect(mockInstances).toHaveLength(0);
  });

  it('logs a warning when one-shot nextRunAt update fails with an Error', async () => {
    const fireAt = new Date('2099-06-01T00:00:00Z');
    const jobs = [
      {
        id: 'os-fail',
        name: 'Fail One Shot',
        schedule: null,
        fireAt,
        prompt: 'fire',
        threadId: 'thread-f',
        agentId: 'agent-1',
        projectId: null,
      },
    ];
    const db = createMockDb(jobs);
    db.cronJob.update.mockRejectedValueOnce(new Error('DB write failed'));
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to set nextRunAt for one-shot job'));
  });

  it('stop() calls stop() on the one-shot Cron handle', async () => {
    const fireAt = new Date('2099-06-01T00:00:00Z');
    const mockOneShotStop = vi.fn();
    mockScheduleOneShot.mockReturnValueOnce({ stop: mockOneShotStop, nextRun: vi.fn().mockReturnValue(null) } as never);

    const jobs = [
      {
        id: 'os-stop',
        name: 'Stoppable One Shot',
        schedule: null,
        fireAt,
        prompt: 'fire',
        threadId: 'thread-s',
        agentId: 'agent-1',
        projectId: null,
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    const server = createCronServer();
    await server.start(ctx);

    await server.stop();

    expect(mockOneShotStop).toHaveBeenCalledOnce();
  });

  // --- Recurring trigger: resolveOrCreateThread error branch ---

  it('trigger handler logs error and returns early when resolveOrCreateThread throws an Error', async () => {
    const jobs = [
      {
        id: 'job-resolve-err',
        name: 'Resolve Error Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'ping',
        threadId: 'thread-1',
      },
    ];
    const db = createMockDb(jobs);
    const ctx = createMockContext({ db: db as never });

    mockResolveOrCreateThread.mockRejectedValueOnce(new Error('thread creation failed'));

    const server = createCronServer();
    await server.start(ctx);

    db.cronJob.update.mockClear();

    const instance = mockInstances[0];
    if (!instance) {
      throw new Error('No cron instance created');
    }

    await instance._handler();

    expect(ctx.reportBackgroundError).toHaveBeenCalledWith('cron-job:Resolve Error Job:resolve-thread', expect.any(Error));
    // sendToThread and update should NOT have been called
    expect(ctx.sendToThread).not.toHaveBeenCalled();
    expect(db.cronJob.update).not.toHaveBeenCalled();
  });
});
