import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleScheduleTask } from '../handle-schedule-task';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'thread-1',
          agentId: 'agent-1',
          projectId: 'project-1',
        }),
      },
      cronJob: {
        create: vi.fn().mockImplementation(({ data }) => ({
          id: 'cron-job-1',
          ...data,
        })),
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
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = {
  threadId: 'meta-thread-1',
};

describe('handleScheduleTask', () => {
  it('creates a recurring job correctly', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: 'Daily Digest', prompt: 'Summarize the day', schedule: '0 9 * * *' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { create: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.create).toHaveBeenCalledWith({
      data: {
        name: 'Daily Digest',
        prompt: 'Summarize the day',
        schedule: '0 9 * * *',
        fireAt: null,
        threadId: 'meta-thread-1',
        agentId: 'agent-1',
        projectId: 'project-1',
        enabled: true,
      },
    });
    expect(result).toContain('Scheduled task');
    expect(result).toContain('Daily Digest');
    expect(result).toContain('0 9 * * *');
  });

  it('creates a one-shot job correctly', async () => {
    const ctx = createMockContext();
    const fireAt = '2099-06-15T14:00:00Z';

    const result = await handleScheduleTask(ctx, { name: 'One-Time Report', prompt: 'Generate report', fireAt }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { create: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.create).toHaveBeenCalledWith({
      data: {
        name: 'One-Time Report',
        prompt: 'Generate report',
        schedule: null,
        fireAt: new Date(fireAt),
        threadId: 'meta-thread-1',
        agentId: 'agent-1',
        projectId: 'project-1',
        enabled: true,
      },
    });
    expect(result).toContain('Scheduled task');
    expect(result).toContain('One-Time Report');
    expect(result).toContain('2099-06-15T14:00:00.000Z');
  });

  it('defaults threadId to meta.threadId', async () => {
    const ctx = createMockContext();

    await handleScheduleTask(ctx, { name: 'Default Thread', prompt: 'Run task', schedule: '0 0 * * *' }, { threadId: 'from-meta' });

    const db = ctx.db as unknown as {
      thread: { findUnique: ReturnType<typeof vi.fn> };
    };
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'from-meta' },
      select: { id: true, agentId: true, projectId: true },
    });
  });

  it('uses explicit threadId over meta.threadId', async () => {
    const ctx = createMockContext();

    await handleScheduleTask(
      ctx,
      {
        name: 'Explicit Thread',
        prompt: 'Run task',
        schedule: '0 0 * * *',
        threadId: 'explicit-thread',
      },
      { threadId: 'from-meta' },
    );

    const db = ctx.db as unknown as {
      thread: { findUnique: ReturnType<typeof vi.fn> };
    };
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'explicit-thread' },
      select: { id: true, agentId: true, projectId: true },
    });
  });

  it('errors when thread not found', async () => {
    const ctx = createMockContext({
      db: {
        thread: { findUnique: vi.fn().mockResolvedValue(null) },
        cronJob: { create: vi.fn() },
      } as never,
    });

    const result = await handleScheduleTask(ctx, { name: 'Ghost Thread', prompt: 'Run', schedule: '0 0 * * *' }, defaultMeta);

    expect(result).toContain('Error: thread not found');
  });

  it('errors when thread has no agent', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            agentId: null,
            projectId: null,
          }),
        },
        cronJob: { create: vi.fn() },
      } as never,
    });

    const result = await handleScheduleTask(ctx, { name: 'No Agent', prompt: 'Run', schedule: '0 0 * * *' }, defaultMeta);

    expect(result).toContain('Error: thread has no associated agent');
  });

  it('errors when both schedule and fireAt are set', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(
      ctx,
      {
        name: 'Bad Config',
        prompt: 'Run',
        schedule: '0 9 * * *',
        fireAt: '2099-01-01T00:00:00Z',
      },
      defaultMeta,
    );

    expect(result).toContain('Error:');
    expect(result).toContain('both');
  });

  it('errors when neither schedule nor fireAt is set', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: 'No Schedule', prompt: 'Run' }, defaultMeta);

    expect(result).toContain('Error:');
    expect(result).toContain('neither');
  });

  it('errors when name is empty', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: '  ', prompt: 'Run', schedule: '0 0 * * *' }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('errors when prompt is empty', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: 'Valid Name', prompt: '', schedule: '0 0 * * *' }, defaultMeta);

    expect(result).toContain('Error: prompt is required');
  });

  it('calls ctx.notifySettingsChange with cron after successful job creation', async () => {
    const ctx = createMockContext();

    await handleScheduleTask(ctx, { name: 'Hot Reload Job', prompt: 'Run task', schedule: '0 9 * * *' }, defaultMeta);

    expect(ctx.notifySettingsChange).toHaveBeenCalledWith('cron');
  });

  it('does not call ctx.notifySettingsChange when job creation fails due to validation error', async () => {
    const ctx = createMockContext();

    // Both schedule and fireAt set — validation fails before DB write
    await handleScheduleTask(
      ctx,
      {
        name: 'Invalid Job',
        prompt: 'Run task',
        schedule: '0 9 * * *',
        fireAt: '2099-01-01T00:00:00Z',
      },
      defaultMeta,
    );

    expect(ctx.notifySettingsChange).not.toHaveBeenCalled();
  });

  it('errors when cron expression is invalid', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: 'Bad Cron', prompt: 'Run', schedule: 'not a cron expression' }, defaultMeta);

    expect(result).toContain('Error: invalid cron expression');
    expect(result).toContain('not a cron expression');
  });

  it('propagates error when cronJob.create throws (e.g. duplicate name)', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            agentId: 'agent-1',
            projectId: 'project-1',
          }),
        },
        cronJob: {
          create: vi.fn().mockRejectedValue(new Error('Unique constraint failed on the fields: (`name`)')),
        },
      } as never,
    });

    await expect(handleScheduleTask(ctx, { name: 'Duplicate Name', prompt: 'Run', schedule: '0 9 * * *' }, defaultMeta)).rejects.toThrow(
      'Unique constraint',
    );
  });

  it('logs a warning when notifySettingsChange rejects after successful creation', async () => {
    const ctx = createMockContext();
    (ctx.notifySettingsChange as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('reload failed'));

    await handleScheduleTask(ctx, { name: 'Reload Fail Job', prompt: 'Run', schedule: '0 9 * * *' }, defaultMeta);

    // Fire-and-forget: need to flush microtasks for the .catch() handler to run
    await vi.waitFor(() => {
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('hot-reload failed after schedule_task'));
    });
  });

  it('errors when fireAt is not a valid datetime string', async () => {
    const ctx = createMockContext();

    const result = await handleScheduleTask(ctx, { name: 'Bad Date', prompt: 'Run', fireAt: 'not-a-date' }, defaultMeta);

    expect(result).toContain('Error: fireAt is not a valid ISO 8601 datetime');
  });
});
