import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { deleteCronJob } from '../delete-cron-job';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const mockJob = {
  id: 'cron-1',
  name: 'Morning Digest',
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
        delete: vi.fn().mockResolvedValue(mockJob),
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

describe('deleteCronJob', () => {
  it('deletes a job by name', async () => {
    const ctx = createMockContext();

    const result = await deleteCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { delete: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.delete).toHaveBeenCalledWith({
      where: { id: 'cron-1' },
    });
    expect(result).toContain('Deleted "Morning Digest"');
    expect(result).toContain('Scheduler reloaded');
  });

  it('scopes lookup to calling agent', async () => {
    const ctx = createMockContext();

    await deleteCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findFirst: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findFirst).toHaveBeenCalledWith({
      where: { name: 'Morning Digest', agentId: 'agent-1' },
    });
  });

  it('triggers hot-reload after successful deletion', async () => {
    const ctx = createMockContext();

    await deleteCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    expect(ctx.notifySettingsChange).toHaveBeenCalledWith('cron');
  });

  it('returns error when job not found (or not owned by agent)', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: {
          findFirst: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
        },
      } as never,
    });

    const result = await deleteCronJob(ctx, { name: 'Nonexistent' }, defaultMeta);

    expect(result).toContain('No scheduled task found');
    expect(result).toContain('Nonexistent');
  });

  it('does not trigger hot-reload when job not found', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: {
          findFirst: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
        },
      } as never,
    });

    await deleteCronJob(ctx, { name: 'Nonexistent' }, defaultMeta);

    expect(ctx.notifySettingsChange).not.toHaveBeenCalled();
  });

  it('errors when name is empty', async () => {
    const ctx = createMockContext();

    const result = await deleteCronJob(ctx, { name: '  ' }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('errors when name is not a string', async () => {
    const ctx = createMockContext();

    const result = await deleteCronJob(ctx, { name: 42 }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('does not call delete when name validation fails', async () => {
    const ctx = createMockContext();

    await deleteCronJob(ctx, { name: '' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { delete: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.delete).not.toHaveBeenCalled();
  });

  it('errors when thread has no agent', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: null }),
        },
        cronJob: { findFirst: vi.fn(), delete: vi.fn() },
      } as never,
    });

    const result = await deleteCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    expect(result).toContain('Error:');
  });
});
