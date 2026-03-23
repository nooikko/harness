import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { listCronJobs } from '../list-cron-jobs';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
      },
      cronJob: {
        findMany: vi.fn().mockResolvedValue([
          {
            name: 'Morning Digest',
            schedule: '0 14 * * *',
            fireAt: null,
            enabled: true,
            lastRunAt: null,
            nextRunAt: new Date('2099-01-01T14:00:00Z'),
          },
          {
            name: 'Weekly Review',
            schedule: '0 0 * * 6',
            fireAt: null,
            enabled: false,
            lastRunAt: null,
            nextRunAt: null,
          },
        ]),
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
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = { threadId: 'thread-1' };

describe('listCronJobs', () => {
  it('returns all jobs as JSON when no filter is set', async () => {
    const ctx = createMockContext();

    const result = await listCronJobs(ctx, {}, defaultMeta);
    const { text, blocks } = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Morning Digest');
    expect(parsed[1].name).toBe('Weekly Review');
    expect(blocks[0]).toMatchObject({ type: 'cron-jobs' });
  });

  it('scopes query to calling agent', async () => {
    const ctx = createMockContext();

    await listCronJobs(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findMany: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: 'agent-1' } }));
  });

  it('passes enabledOnly filter combined with agentId', async () => {
    const ctx = createMockContext();

    await listCronJobs(ctx, { enabledOnly: true }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findMany: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-1', enabled: true },
      select: {
        name: true,
        schedule: true,
        fireAt: true,
        enabled: true,
        lastRunAt: true,
        nextRunAt: true,
      },
      orderBy: { name: 'asc' },
    });
  });

  it('returns friendly message when no jobs exist', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });

    const result = await listCronJobs(ctx, {}, defaultMeta);

    expect(result).toBe('No scheduled tasks found.');
  });

  it('returns enabledOnly-specific message when filtering yields no results', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: 'agent-1' }),
        },
        cronJob: { findMany: vi.fn().mockResolvedValue([]) },
      } as never,
    });

    const result = await listCronJobs(ctx, { enabledOnly: true }, defaultMeta);

    expect(result).toBe('No enabled scheduled tasks found.');
  });

  it('returns error when thread has no agent', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ agentId: null }),
        },
        cronJob: { findMany: vi.fn() },
      } as never,
    });

    const result = await listCronJobs(ctx, {}, defaultMeta);

    expect(result).toContain('Error:');
  });

  it('treats non-boolean enabledOnly as false', async () => {
    const ctx = createMockContext();

    await listCronJobs(ctx, { enabledOnly: 'true' }, defaultMeta);

    const db = ctx.db as unknown as {
      cronJob: { findMany: ReturnType<typeof vi.fn> };
    };
    expect(db.cronJob.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: 'agent-1' } }));
  });
});
