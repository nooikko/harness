import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { getCronJob } from '../get-cron-job';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const mockJob = {
  name: 'Morning Digest',
  prompt: 'Summarize the morning news',
  schedule: '0 14 * * *',
  fireAt: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: new Date('2099-01-01T14:00:00Z'),
};

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
      },
      cronJob: {
        findFirst: vi.fn().mockResolvedValue(mockJob),
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
    reportBackgroundError: vi.fn(),
    runBackground: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = { threadId: 'thread-1' };

describe('getCronJob', () => {
  it('returns job details as JSON without internal IDs', async () => {
    const ctx = createMockContext();

    const result = await getCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe('Morning Digest');
    expect(parsed.prompt).toBe('Summarize the morning news');
    expect(parsed.schedule).toBe('0 14 * * *');
    expect(parsed.id).toBeUndefined();
    expect(parsed.agentId).toBeUndefined();
    expect(parsed.threadId).toBeUndefined();
    expect(parsed.projectId).toBeUndefined();
  });

  it('scopes query by name and agentId', async () => {
    const ctx = createMockContext();

    await getCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findFirst: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findFirst).toHaveBeenCalledWith({
      where: { name: 'Morning Digest', agentId: 'agent-1' },
      select: {
        name: true,
        prompt: true,
        schedule: true,
        fireAt: true,
        enabled: true,
        lastRunAt: true,
        nextRunAt: true,
      },
    });
  });

  it('returns error when job not found (or not owned by agent)', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: { findFirst: vi.fn().mockResolvedValue(null) },
      } as never,
    });

    const result = await getCronJob(ctx, { name: 'Nonexistent' }, defaultMeta);

    expect(result).toContain('No scheduled task found');
    expect(result).toContain('Nonexistent');
  });

  it('errors when name is empty', async () => {
    const ctx = createMockContext();

    const result = await getCronJob(ctx, { name: '  ' }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('errors when name is not a string', async () => {
    const ctx = createMockContext();

    const result = await getCronJob(ctx, { name: 123 }, defaultMeta);

    expect(result).toContain('Error: name is required');
  });

  it('errors when thread has no agent', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: null }),
        },
        cronJob: { findFirst: vi.fn() },
      } as never,
    });

    const result = await getCronJob(ctx, { name: 'Morning Digest' }, defaultMeta);

    expect(result).toContain('Error:');
  });
});
