import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { completeTask } from '../complete-task';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      userTask: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'task-1',
          title: 'My Task',
          status: 'TODO',
        }),
        update: vi.fn().mockImplementation(({ data }) => ({
          id: 'task-1',
          title: 'My Task',
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
  threadId: 'thread-1',
};

type MockDb = {
  userTask: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('completeTask', () => {
  it('returns error when id is missing', async () => {
    const ctx = createMockContext();
    const result = await completeTask(ctx, {}, defaultMeta);

    expect(result).toBe('(invalid input: id is required)');
  });

  it('returns error when id is not a string', async () => {
    const ctx = createMockContext();
    const result = await completeTask(ctx, { id: 99 }, defaultMeta);

    expect(result).toBe('(invalid input: id is required)');
  });

  it('returns not found when task does not exist', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      } as never,
    });

    const result = await completeTask(ctx, { id: 'missing' }, defaultMeta);

    expect(result).toBe('(task not found: missing)');
  });

  it('returns already done message when task status is DONE', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'task-1',
            title: 'Done Task',
            status: 'DONE',
          }),
          update: vi.fn(),
        },
      } as never,
    });

    const result = await completeTask(ctx, { id: 'task-1' }, defaultMeta);

    expect(result).toContain('already done');
    expect(result).toContain('Done Task');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).not.toHaveBeenCalled();
  });

  it('marks task as DONE with completedAt timestamp', async () => {
    const ctx = createMockContext();
    const before = new Date();

    await completeTask(ctx, { id: 'task-1' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: {
        status: 'DONE',
        completedAt: expect.any(Date),
      },
    });

    const callData = db.userTask.update.mock.calls[0]?.[0].data;
    expect(callData.completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('returns confirmation message on success', async () => {
    const ctx = createMockContext();
    const result = await completeTask(ctx, { id: 'task-1' }, defaultMeta);

    expect(result).toContain('Task completed');
    expect(result).toContain('My Task');
    expect(result).toContain('task-1');
  });

  it('rethrows unknown errors from task update', async () => {
    const unknownError = new Error('Database connection lost');
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'task-1',
            title: 'My Task',
            status: 'TODO',
          }),
          update: vi.fn().mockRejectedValue(unknownError),
        },
      } as never,
    });

    await expect(completeTask(ctx, { id: 'task-1' }, defaultMeta)).rejects.toThrow('Database connection lost');
  });

  it('completes an IN_PROGRESS task', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'task-2',
            title: 'In Progress Task',
            status: 'IN_PROGRESS',
          }),
          update: vi.fn().mockResolvedValue({
            id: 'task-2',
            title: 'In Progress Task',
            status: 'DONE',
          }),
        },
      } as never,
    });

    const result = await completeTask(ctx, { id: 'task-2' }, defaultMeta);

    expect(result).toContain('Task completed');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalled();
  });
});
