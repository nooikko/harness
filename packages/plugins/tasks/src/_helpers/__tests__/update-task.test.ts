import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { updateTask } from '../update-task';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      userTask: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'task-1',
          title: 'Original',
          status: 'TODO',
          priority: 'MEDIUM',
        }),
        update: vi.fn().mockImplementation(({ data }) => ({
          id: 'task-1',
          title: data.title ?? 'Original',
          status: data.status ?? 'TODO',
          priority: data.priority ?? 'MEDIUM',
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

describe('updateTask', () => {
  it('returns error when id is missing', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, {}, defaultMeta);

    expect(result).toBe('(invalid input: id is required)');
  });

  it('returns error when id is not a string', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 42 }, defaultMeta);

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

    const result = await updateTask(ctx, { id: 'missing' }, defaultMeta);

    expect(result).toBe('(task not found: missing)');
  });

  it('updates title when provided', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', title: 'New Title' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { title: 'New Title' },
    });
  });

  it('updates description when provided', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', description: 'New desc' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { description: 'New desc' },
    });
  });

  it('updates status when valid', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', status: 'IN_PROGRESS' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'IN_PROGRESS', completedAt: null },
    });
  });

  it('ignores invalid status', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 'task-1', status: 'INVALID_STATUS' }, defaultMeta);

    // Invalid status is skipped, and no other fields provided → no valid fields
    expect(result).toBe('(no valid fields to update)');
  });

  it('updates priority when valid', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', priority: 'URGENT' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { priority: 'URGENT' },
    });
  });

  it('ignores invalid priority', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 'task-1', priority: 'SUPER_HIGH' }, defaultMeta);

    expect(result).toBe('(no valid fields to update)');
  });

  it('updates dueDate when provided', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', dueDate: '2099-06-15T00:00:00Z' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { dueDate: new Date('2099-06-15T00:00:00Z') },
    });
  });

  it('clears dueDate when set to empty string', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', dueDate: '' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { dueDate: null },
    });
  });

  it('returns no valid fields when only invalid fields provided', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 'task-1', status: 'BAD', priority: 'BAD' }, defaultMeta);

    expect(result).toBe('(no valid fields to update)');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).not.toHaveBeenCalled();
  });

  it('handles partial updates with multiple valid fields', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', title: 'Updated', status: 'DONE', priority: 'HIGH' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { title: 'Updated', status: 'DONE', priority: 'HIGH', completedAt: expect.any(Date) },
    });
  });

  it('returns confirmation message on success', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 'task-1', title: 'Updated Title' }, defaultMeta);

    expect(result).toContain('Task updated');
    expect(result).toContain('Updated Title');
  });

  it('sets completedAt when status is set to DONE', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', status: 'DONE' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'DONE', completedAt: expect.any(Date) },
    });
  });

  it('clears completedAt when status is set to IN_PROGRESS', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', status: 'IN_PROGRESS' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'IN_PROGRESS', completedAt: null },
    });
  });

  it('clears completedAt when status is set to TODO', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', status: 'TODO' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'TODO', completedAt: null },
    });
  });

  it('clears completedAt when status is set to CANCELLED', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', status: 'CANCELLED' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'CANCELLED', completedAt: null },
    });
  });

  it('does not set completedAt when only title is updated', async () => {
    const ctx = createMockContext();
    await updateTask(ctx, { id: 'task-1', title: 'New name' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { title: 'New name' },
    });
  });

  it('returns error for invalid dueDate string', async () => {
    const ctx = createMockContext();
    const result = await updateTask(ctx, { id: 'task-1', dueDate: 'not-a-date' }, defaultMeta);

    expect(result).toBe('(invalid input: dueDate is not a valid date)');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTask.update).not.toHaveBeenCalled();
  });
});
