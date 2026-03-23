import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Plugin-level tests: createCronServer is fully mocked so we can verify the
// plugin's start/stop lifecycle in isolation.
// ---------------------------------------------------------------------------

vi.mock('../_helpers/cron-server', () => ({
  createCronServer: vi.fn(),
}));

import { createCronServer } from '../_helpers/cron-server';
import { plugin } from '../index';

const mockCreateCronServer = vi.mocked(createCronServer);

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () => ({
  db: {} as never,
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
  sendToThread: vi.fn(),
  broadcast: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn().mockResolvedValue(undefined),
  reportStatus: vi.fn(),
  reportBackgroundError: vi.fn(),
  uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
});

describe('cron plugin', () => {
  beforeEach(() => {
    mockCreateCronServer.mockClear();
    vi.resetModules();
  });

  it('register() returns hooks object with onSettingsChange and logs info', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(hooks).toHaveProperty('onSettingsChange');
    expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin registered');
  });

  describe('onSettingsChange', () => {
    it('ignores non-cron plugin names and does not restart the server', async () => {
      const ctx = createMockContext();
      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockStop = vi.fn().mockResolvedValue(undefined);

      mockCreateCronServer.mockReturnValue({
        start: mockStart,
        stop: mockStop,
      });

      await plugin.start?.(ctx);
      mockCreateCronServer.mockClear();
      mockStart.mockClear();
      mockStop.mockClear();

      const hooks = await plugin.register(ctx);
      await hooks.onSettingsChange?.('discord');

      expect(mockStop).not.toHaveBeenCalled();
      expect(mockCreateCronServer).not.toHaveBeenCalled();
      expect(ctx.logger.info).not.toHaveBeenCalledWith('Cron plugin: reloading scheduled jobs...');
    });

    it('stops the current server and restarts when pluginName is cron', async () => {
      const ctx = createMockContext();
      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockStop = vi.fn().mockResolvedValue(undefined);

      mockCreateCronServer.mockReturnValue({
        start: mockStart,
        stop: mockStop,
      });

      await plugin.start?.(ctx);

      const hooks = await plugin.register(ctx);
      await hooks.onSettingsChange?.('cron');

      expect(mockStop).toHaveBeenCalledOnce();
      expect(mockCreateCronServer).toHaveBeenCalledTimes(2);
      expect(mockStart).toHaveBeenCalledTimes(2);
      expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin: reloading scheduled jobs...');
      expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin: reload complete');
    });

    it('still restarts when server was never started (stopServer is null)', async () => {
      // Use a fresh plugin instance to ensure stopServer is null
      const { plugin: freshPlugin } = await import('../index');
      const ctx = createMockContext();
      const mockStart = vi.fn().mockResolvedValue(undefined);
      const mockStop = vi.fn().mockResolvedValue(undefined);

      mockCreateCronServer.mockReturnValue({
        start: mockStart,
        stop: mockStop,
      });

      const hooks = await freshPlugin.register(ctx);

      // Should not throw even though stopServer is null
      await expect(hooks.onSettingsChange?.('cron')).resolves.toBeUndefined();

      // stop was not called (nothing to stop), but start was called to reload
      expect(mockStop).not.toHaveBeenCalled();
      expect(mockCreateCronServer).toHaveBeenCalledOnce();
      expect(mockStart).toHaveBeenCalledOnce();
      expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin: reloading scheduled jobs...');
      expect(ctx.logger.info).toHaveBeenCalledWith('Cron plugin: reload complete');
    });

    it('serializes concurrent onSettingsChange calls via reload lock', async () => {
      const ctx = createMockContext();
      const callOrder: string[] = [];
      const mockStop = vi.fn().mockImplementation(async () => {
        callOrder.push('stop');
      });
      const mockStart = vi.fn().mockImplementation(async () => {
        callOrder.push('start');
      });

      mockCreateCronServer.mockReturnValue({
        start: mockStart,
        stop: mockStop,
      });

      // Start the server first so stopServer is set
      await plugin.start?.(ctx);
      callOrder.length = 0;
      mockStop.mockClear();
      mockStart.mockClear();
      mockCreateCronServer.mockClear();

      mockCreateCronServer.mockReturnValue({
        start: mockStart,
        stop: mockStop,
      });

      const hooks = await plugin.register(ctx);

      // Fire two reloads concurrently
      const reload1 = hooks.onSettingsChange?.('cron');
      const reload2 = hooks.onSettingsChange?.('cron');

      await Promise.all([reload1, reload2]);

      // Both reloads should complete — stop+start should be called twice each
      // and should be serialized (never two starts or two stops running simultaneously)
      expect(mockStop).toHaveBeenCalledTimes(2);
      expect(mockCreateCronServer).toHaveBeenCalledTimes(2);
      expect(mockStart).toHaveBeenCalledTimes(2);

      // Verify serialized order: stop-start-stop-start (not stop-stop-start-start)
      expect(callOrder).toEqual(['stop', 'start', 'stop', 'start']);
    });
  });

  it('start() creates a cron server and calls server.start()', async () => {
    const ctx = createMockContext();
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const mockStop = vi.fn().mockResolvedValue(undefined);

    mockCreateCronServer.mockReturnValueOnce({
      start: mockStart,
      stop: mockStop,
    });

    await plugin.start?.(ctx);

    expect(mockCreateCronServer).toHaveBeenCalledOnce();
    expect(mockCreateCronServer).toHaveBeenCalledWith({ timezone: 'UTC' });
    expect(mockStart).toHaveBeenCalledWith(ctx);
  });

  it('start() passes custom timezone from settings to createCronServer', async () => {
    const ctx = createMockContext();
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ timezone: 'America/Phoenix' });
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const mockStop = vi.fn().mockResolvedValue(undefined);

    mockCreateCronServer.mockReturnValueOnce({
      start: mockStart,
      stop: mockStop,
    });

    await plugin.start?.(ctx);

    expect(mockCreateCronServer).toHaveBeenCalledWith({ timezone: 'America/Phoenix' });
  });

  it('stop() calls the stop handle stored during start()', async () => {
    const ctx = createMockContext();
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const mockStop = vi.fn().mockResolvedValue(undefined);

    mockCreateCronServer.mockReturnValueOnce({
      start: mockStart,
      stop: mockStop,
    });

    await plugin.start?.(ctx);
    await plugin.stop?.(ctx);

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('stop() is a no-op when called before start()', async () => {
    // Import a fresh module instance so stopServer is null
    const { plugin: freshPlugin } = await import('../index');
    const ctx = createMockContext();

    // Should not throw
    await expect(freshPlugin.stop?.(ctx)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration-level tests: createCronServer runs for real.
// croner and the schedule-one-shot helper are mocked at their module boundary
// so no real timers or subprocesses are created.
// realCreateCronServer is loaded via vi.importActual to bypass the top-level
// vi.mock('../_helpers/cron-server') that the plugin-level tests require.
// ---------------------------------------------------------------------------

// Captured croner instances so tests can call handlers directly
type MockCronInstance = {
  stop: ReturnType<typeof vi.fn>;
  nextRun: ReturnType<typeof vi.fn>;
  _handler: () => Promise<void>;
};

const cronInstances: MockCronInstance[] = [];

vi.mock('croner', () => {
  class MockCron {
    stop: ReturnType<typeof vi.fn>;
    nextRun: ReturnType<typeof vi.fn>;
    _handler: () => Promise<void>;

    constructor(_schedule: string, _opts: Record<string, unknown>, handler: () => Promise<void>) {
      this.stop = vi.fn();
      this.nextRun = vi.fn().mockReturnValue(new Date('2099-01-01T00:00:00Z'));
      this._handler = handler;
      cronInstances.push(this as MockCronInstance);
    }
  }

  return { Cron: MockCron };
});

// Captured one-shot schedule calls — returns a mock Cron instance
type OneShotCall = {
  ctx: PluginContext;
  job: { id: string; name: string };
  cleanup: (jobId: string) => void;
};

const oneShotCalls: OneShotCall[] = [];
// Stores mock Cron handles so tests can verify stop() behavior
const oneShotCronHandles: Map<string, { stop: ReturnType<typeof vi.fn> }> = new Map();

vi.mock('../_helpers/schedule-one-shot', () => ({
  scheduleOneShot: vi.fn((ctx: PluginContext, job: { id: string; name: string }, cleanup: (jobId: string) => void) => {
    const cronHandle = { stop: vi.fn(), nextRun: vi.fn().mockReturnValue(null) };
    oneShotCalls.push({ ctx, job, cleanup });
    oneShotCronHandles.set(job.id, cronHandle);
    return cronHandle;
  }),
}));

// resolveOrCreateThread is mocked to avoid real DB calls
vi.mock('../_helpers/resolve-or-create-thread', () => ({
  resolveOrCreateThread: vi.fn(),
}));

import type { CronServer } from '../_helpers/cron-server';
import { resolveOrCreateThread } from '../_helpers/resolve-or-create-thread';
import { scheduleOneShot } from '../_helpers/schedule-one-shot';

const mockResolveOrCreateThread = vi.mocked(resolveOrCreateThread);
const mockScheduleOneShot = vi.mocked(scheduleOneShot);

type CreateIntegrationDb = (jobs?: object[]) => {
  cronJob: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  thread: {
    create: ReturnType<typeof vi.fn>;
  };
};

const createIntegrationDb: CreateIntegrationDb = (jobs = []) => ({
  cronJob: {
    findMany: vi.fn().mockResolvedValue(jobs),
    update: vi.fn().mockResolvedValue(undefined),
  },
  thread: {
    create: vi.fn().mockResolvedValue({ id: 'new-thread-id' }),
  },
});

type CreateIntegrationContext = (overrides?: Partial<PluginContext>) => PluginContext;

const createIntegrationContext: CreateIntegrationContext = (overrides = {}) =>
  ({
    db: createIntegrationDb() as never,
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
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

describe('createCronServer — integration', () => {
  // Load the real createCronServer via importActual so the module-level
  // vi.mock('../_helpers/cron-server') for the plugin tests does not intercept it.
  let realCreateCronServer: () => CronServer;

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import('../_helpers/cron-server')>('../_helpers/cron-server');
    realCreateCronServer = actual.createCronServer;

    cronInstances.length = 0;
    oneShotCalls.length = 0;
    oneShotCronHandles.clear();
    mockResolveOrCreateThread.mockReset();
    mockScheduleOneShot.mockClear();
  });

  afterEach(() => {
    oneShotCronHandles.clear();
  });

  // 1. Mixed job types
  it('schedules recurring jobs with croner and one-shot jobs with scheduleOneShot when both types are present', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const jobs = [
      {
        id: 'recurring-1',
        name: 'Daily Digest',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'send digest',
        threadId: 'thread-recurring',
        agentId: 'agent-1',
        projectId: null,
      },
      {
        id: 'oneshot-1',
        name: 'One-time Alert',
        schedule: null,
        fireAt: futureDate,
        prompt: 'send alert',
        threadId: 'thread-oneshot',
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    // Croner only for the recurring job
    expect(cronInstances).toHaveLength(1);
    // scheduleOneShot only for the one-shot job
    expect(mockScheduleOneShot).toHaveBeenCalledOnce();
    expect(mockScheduleOneShot).toHaveBeenCalledWith(ctx, expect.objectContaining({ id: 'oneshot-1', name: 'One-time Alert' }), expect.any(Function));

    await server.stop();
  });

  // 2. Invalid job (both schedule and fireAt set) is skipped with a warning
  it('skips a job that has both schedule and fireAt set and logs a warning', async () => {
    const jobs = [
      {
        id: 'invalid-1',
        name: 'Ambiguous Job',
        schedule: '0 9 * * *',
        fireAt: new Date(Date.now() + 60_000),
        prompt: 'do something',
        threadId: 'thread-1',
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    expect(cronInstances).toHaveLength(0);
    expect(mockScheduleOneShot).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Ambiguous Job'));

    await server.stop();
  });

  // 3. One-shot auto-disable: the cleanup callback removes the timer handle from the
  // internal map so stop() does not attempt to clear an already-fired timer
  it('removes the one-shot timer handle via the cleanup callback when the job fires', async () => {
    const futureDate = new Date(Date.now() + 10_000);
    const jobs = [
      {
        id: 'oneshot-auto',
        name: 'Auto Disable Job',
        schedule: null,
        fireAt: futureDate,
        prompt: 'fire once',
        threadId: 'thread-oneshot-auto',
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    // scheduleOneShot was called and received a cleanup callback
    expect(oneShotCalls).toHaveLength(1);
    const call = oneShotCalls[0];
    if (!call) {
      throw new Error('Expected one-shot call to exist');
    }

    // Simulate the job firing: invoke the cleanup callback
    call.cleanup('oneshot-auto');

    // After cleanup the internal map entry is removed — stop() should still
    // complete without error even though the timer was already cleaned up
    await server.stop();

    // No recurring jobs were scheduled
    expect(cronInstances).toHaveLength(0);
  });

  // 3b. One-shot: cron-server sets nextRunAt = fireAt on startup for admin UI visibility
  it('writes nextRunAt = fireAt to the DB on startup for one-shot jobs', async () => {
    const futureDate = new Date(Date.now() + 5_000);
    const jobs = [
      {
        id: 'oneshot-db',
        name: 'DB Disable Job',
        schedule: null,
        fireAt: futureDate,
        prompt: 'run once',
        threadId: 'thread-db',
        agentId: 'agent-2',
        projectId: null,
      },
    ];

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    // The cron-server sets nextRunAt = fireAt on startup for one-shot jobs
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'oneshot-db' },
      data: { nextRunAt: futureDate },
    });

    await server.stop();
  });

  // 4. Lazy thread creation: recurring job with null threadId calls resolveOrCreateThread
  it('calls resolveOrCreateThread on trigger when threadId is null, then fires sendToThread with the created thread', async () => {
    const jobs = [
      {
        id: 'lazy-thread-1',
        name: 'Lazy Thread Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'do work',
        threadId: null,
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    mockResolveOrCreateThread.mockResolvedValueOnce('created-thread-id');

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    // One croner job was created for the recurring job
    expect(cronInstances).toHaveLength(1);

    const instance = cronInstances[0];
    if (!instance) {
      throw new Error('Expected cron instance');
    }

    // Simulate the cron trigger firing
    await instance._handler();

    // After Phase 1 fix: the in-memory job.threadId is mutated to the created thread ID
    // so we just verify the call happened with the right job id
    expect(mockResolveOrCreateThread).toHaveBeenCalledWith(ctx.db, expect.objectContaining({ id: 'lazy-thread-1' }));
    expect(ctx.sendToThread).toHaveBeenCalledWith('created-thread-id', 'do work');

    await server.stop();
  });

  // 4b. resolveOrCreateThread failure is logged and sendToThread is NOT called
  it('logs an error and skips sendToThread when resolveOrCreateThread throws for a recurring job', async () => {
    const jobs = [
      {
        id: 'lazy-thread-fail',
        name: 'Thread Fail Job',
        schedule: '* * * * *',
        fireAt: null,
        prompt: 'do work',
        threadId: null,
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    mockResolveOrCreateThread.mockRejectedValueOnce(new Error('DB unavailable'));

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    const instance = cronInstances[0];
    if (!instance) {
      throw new Error('Expected cron instance');
    }

    await instance._handler();

    expect(ctx.reportBackgroundError).toHaveBeenCalledWith("cron-job:Thread Fail Job:resolve-thread", expect.any(Error));
    expect(ctx.sendToThread).not.toHaveBeenCalled();

    await server.stop();
  });

  // 5. Stop cleans up both recurring croner jobs and one-shot Cron handles
  it('stop() calls croner.stop() on all recurring jobs and stops all one-shot Cron handles', async () => {
    const futureDate = new Date(Date.now() + 60_000);
    const jobs = [
      {
        id: 'recurring-stop',
        name: 'Recurring Job',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'recurring',
        threadId: 'thread-r',
        agentId: 'agent-1',
        projectId: null,
      },
      {
        id: 'oneshot-stop',
        name: 'OneShot Job',
        schedule: null,
        fireAt: futureDate,
        prompt: 'one-shot',
        threadId: 'thread-s',
        agentId: 'agent-1',
        projectId: null,
      },
    ];

    const db = createIntegrationDb(jobs);
    const ctx = createIntegrationContext({ db: db as never });

    const server = realCreateCronServer();
    await server.start(ctx);

    expect(cronInstances).toHaveLength(1);
    expect(oneShotCalls).toHaveLength(1);

    const cronInstance = cronInstances[0];
    if (!cronInstance) {
      throw new Error('Expected cron instance');
    }

    await server.stop();

    // Croner.stop() was called for the recurring job
    expect(cronInstance.stop).toHaveBeenCalledOnce();

    // The one-shot Cron handle was stopped
    const oneShotHandle = oneShotCronHandles.get('oneshot-stop');
    expect(oneShotHandle?.stop).toHaveBeenCalledOnce();
  });
});
