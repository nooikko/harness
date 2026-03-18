import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { updateCronJob } from '../update-cron-job';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const mockJob = {
  id: 'cron-1',
  name: 'Morning Digest',
  prompt: 'Summarize the morning news',
  schedule: '0 14 * * *',
  fireAt: null,
  enabled: true,
  agentId: 'agent-1',
};

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
      },
      cronJob: {
        findFirst: vi.fn().mockResolvedValue(mockJob),
        update: vi.fn().mockResolvedValue(mockJob),
      },
    } as never,
    invoker: { invoke: vi.fn() },
    config: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    sendToThread: vi.fn().mockResolvedValue(undefined),
    broadcast: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn().mockResolvedValue(undefined),
    reportStatus: vi.fn(),
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = { threadId: 'thread-1' };

describe('updateCronJob', () => {
  it('updates prompt field', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', prompt: 'New prompt text' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { update: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
      data: { prompt: 'New prompt text' },
    });
    expect(result).toContain('Updated "Morning Digest"');
  });

  it('updates enabled field', async () => {
    const ctx = createMockContext();

    await updateCronJob(ctx, { name: 'Morning Digest', enabled: false }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { update: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
      data: { enabled: false },
    });
  });

  it('updates schedule and clears fireAt', async () => {
    const ctx = createMockContext();

    await updateCronJob(ctx, { name: 'Morning Digest', schedule: '0 15 * * *' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { update: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
      data: { schedule: '0 15 * * *', fireAt: null },
    });
  });

  it('updates fireAt and clears schedule', async () => {
    const ctx = createMockContext();
    const fireAt = '2099-06-15T14:00:00Z';

    await updateCronJob(ctx, { name: 'Morning Digest', fireAt }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { update: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
      data: { fireAt: new Date(fireAt), schedule: null },
    });
  });

  it('triggers hot-reload after successful update', async () => {
    const ctx = createMockContext();

    await updateCronJob(ctx, { name: 'Morning Digest', enabled: true }, defaultMeta);

    expect(ctx.notifySettingsChange).toHaveBeenCalledWith('cron');
  });

  it('scopes lookup to calling agent', async () => {
    const ctx = createMockContext();

    await updateCronJob(ctx, { name: 'Morning Digest', enabled: true }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findFirst: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findFirst).toHaveBeenCalledWith({
      where: { name: 'Morning Digest', agentId: 'agent-1' },
    });
  });

  it('does not trigger hot-reload when job not found', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      } as never,
    });

    await updateCronJob(ctx, { name: 'Nonexistent', enabled: false }, defaultMeta);

    expect(ctx.notifySettingsChange).not.toHaveBeenCalled();
  });

  it('returns error when job not found', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      } as never,
    });

    const result = await updateCronJob(ctx, { name: 'Nonexistent', enabled: false }, defaultMeta);

    expect(result).toContain('No scheduled task found');
  });

  it('errors when name is empty', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: '  ' }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('errors when no update fields are provided', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    expect(result).toContain('No fields to update');
  });

  it('errors when prompt is set to empty string', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', prompt: '  ' }, defaultMeta);

    expect(result).toContain('Error: prompt cannot be empty');
  });

  it('errors when both schedule and fireAt are set', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', schedule: '0 15 * * *', fireAt: '2099-06-15T14:00:00Z' }, defaultMeta);

    expect(result).toContain('Error:');
    expect(result).toContain('cannot both be set');
  });

  it('errors when fireAt is not a valid datetime', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', fireAt: 'not-a-date' }, defaultMeta);

    expect(result).toContain('Error: fireAt is not a valid ISO 8601 datetime');
  });

  it('errors when enabled is not a boolean', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', enabled: 'true' }, defaultMeta);

    expect(result).toContain('Error: enabled must be a boolean');
  });

  it('errors when schedule is empty string', async () => {
    const ctx = createMockContext();

    const result = await updateCronJob(ctx, { name: 'Morning Digest', schedule: '  ' }, defaultMeta);

    expect(result).toContain('Error: schedule cannot be empty');
  });

  it('updates multiple fields at once', async () => {
    const ctx = createMockContext();

    await updateCronJob(ctx, { name: 'Morning Digest', prompt: 'New prompt', enabled: false }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { update: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
      data: { prompt: 'New prompt', enabled: false },
    });
  });

  it('errors when thread has no agent', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: null }),
        },
        cronJob: { findFirst: vi.fn(), update: vi.fn() },
      } as never,
    });

    const result = await updateCronJob(ctx, { name: 'Morning Digest', enabled: true }, defaultMeta);

    expect(result).toContain('Error:');
  });

  it('logs a warning when notifySettingsChange rejects after successful update', async () => {
    const ctx = createMockContext();
    (ctx.notifySettingsChange as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('reload failed'));

    await updateCronJob(ctx, { name: 'Morning Digest', enabled: false }, defaultMeta);

    await vi.waitFor(() => {
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('hot-reload failed after update_task'));
    });
  });
});
