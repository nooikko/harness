import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { addTask } from '../add-task';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      thread: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'thread-1',
          projectId: 'project-1',
        }),
      },
      userTask: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      userTaskDependency: { createMany: vi.fn() },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          userTask: {
            create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
              id: 'task-1',
              ...data,
            })),
          },
          userTaskDependency: {
            createMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        }),
      ),
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
  thread: { findUnique: ReturnType<typeof vi.fn> };
  userTask: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  userTaskDependency: { createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('addTask', () => {
  it('creates a task with required title', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Fix bug' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(result).toContain('Task created');
    expect(result).toContain('Fix bug');
  });

  it('returns error when title is missing', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, {}, defaultMeta);

    expect(result).toBe('(invalid input: title is required)');
  });

  it('returns error when title is not a string', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 123 }, defaultMeta);

    expect(result).toBe('(invalid input: title is required)');
  });

  it('returns error when title is empty string', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: '' }, defaultMeta);

    expect(result).toBe('(invalid input: title is required)');
  });

  it('returns existing task when duplicate found within 1 hour', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: 'project-1' }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-1', title: 'Fix bug' }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn(),
      } as never,
    });

    const result = await addTask(ctx, { title: 'Fix bug' }, defaultMeta);

    expect(result).toContain('Task already exists');
    expect(result).toContain('existing-1');
    const db = ctx.db as unknown as MockDb;
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('defaults priority to MEDIUM when not provided', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Some task' }, defaultMeta);

    expect(result).toContain('priority: MEDIUM');
  });

  it('defaults priority to MEDIUM when invalid priority given', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Some task', priority: 'SUPER_HIGH' }, defaultMeta);

    expect(result).toContain('priority: MEDIUM');
  });

  it('accepts valid priority values', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Urgent task', priority: 'URGENT' }, defaultMeta);

    expect(result).toContain('priority: URGENT');
  });

  it('auto-resolves projectId from thread when not provided', async () => {
    const ctx = createMockContext();
    await addTask(ctx, { title: 'Auto project' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { projectId: true },
    });
    expect(db.$transaction).toHaveBeenCalledOnce();
  });

  it('uses explicit projectId when provided', async () => {
    const ctx = createMockContext();
    await addTask(ctx, { title: 'Explicit project', projectId: 'custom-project' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.thread.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledOnce();
  });

  it('sets projectId to null when thread has no project', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            userTask: {
              create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
                id: 'task-1',
                ...data,
              })),
            },
            userTaskDependency: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
          }),
        ),
      } as never,
    });

    const result = await addTask(ctx, { title: 'No project' }, defaultMeta);

    expect(result).toContain('Task created');
  });

  it('creates dependency links when blockedBy is provided', async () => {
    const txCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const txCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }));
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: 'project-1' }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([{ id: 'dep-1' }, { id: 'dep-2' }]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi
          .fn()
          .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ userTask: { create: txCreate }, userTaskDependency: { createMany: txCreateMany } }),
          ),
      } as never,
    });

    await addTask(ctx, { title: 'Blocked task', blockedBy: ['dep-1', 'dep-2'] }, defaultMeta);

    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { dependentId: 'task-1', dependsOnId: 'dep-1' },
        { dependentId: 'task-1', dependsOnId: 'dep-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('does not create dependencies when blockedBy is empty array', async () => {
    const txCreateMany = vi.fn();
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            userTask: {
              create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
                id: 'task-1',
                ...data,
              })),
            },
            userTaskDependency: { createMany: txCreateMany },
          }),
        ),
      } as never,
    });

    await addTask(ctx, { title: 'No blockers', blockedBy: [] }, defaultMeta);

    expect(txCreateMany).not.toHaveBeenCalled();
  });

  it('does not create dependencies when blockedBy is omitted', async () => {
    const txCreateMany = vi.fn();
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            userTask: {
              create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
                id: 'task-1',
                ...data,
              })),
            },
            userTaskDependency: { createMany: txCreateMany },
          }),
        ),
      } as never,
    });

    await addTask(ctx, { title: 'Solo task' }, defaultMeta);

    expect(txCreateMany).not.toHaveBeenCalled();
  });

  it('parses dueDate as Date object', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Due task', dueDate: '2099-06-15T14:00:00Z' }, defaultMeta);

    expect(result).toContain('Task created');
  });

  it('sets dueDate to null when not provided', async () => {
    const txCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }));
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi
          .fn()
          .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ userTask: { create: txCreate }, userTaskDependency: { createMany: vi.fn() } }),
          ),
      } as never,
    });

    await addTask(ctx, { title: 'No due date' }, defaultMeta);

    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ dueDate: null }),
    });
  });

  it('includes task id and priority in return message', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'My task', priority: 'HIGH' }, defaultMeta);

    expect(result).toContain('task-1');
    expect(result).toContain('HIGH');
  });

  it('sets sourceThreadId from meta.threadId', async () => {
    const txCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }));
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'special-thread', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi
          .fn()
          .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ userTask: { create: txCreate }, userTaskDependency: { createMany: vi.fn() } }),
          ),
      } as never,
    });

    await addTask(ctx, { title: 'Thread task' }, { threadId: 'special-thread' });

    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceThreadId: 'special-thread' }),
    });
  });

  it('sets createdBy to agent', async () => {
    const txCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }));
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: null }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi
          .fn()
          .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ userTask: { create: txCreate }, userTaskDependency: { createMany: vi.fn() } }),
          ),
      } as never,
    });

    await addTask(ctx, { title: 'Agent task' }, defaultMeta);

    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdBy: 'agent' }),
    });
  });

  it('returns error when blockedBy contains non-existent task IDs', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: 'project-1' }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([{ id: 'dep-1' }]), // only 1 of 2 found
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi.fn(),
      } as never,
    });

    const result = await addTask(ctx, { title: 'Blocked task', blockedBy: ['dep-1', 'dep-missing'] }, defaultMeta);

    expect(result).toBe('(invalid input: one or more blockedBy task IDs not found)');
    const db = ctx.db as unknown as MockDb;
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns error for invalid dueDate string', async () => {
    const ctx = createMockContext();
    const result = await addTask(ctx, { title: 'Bad date task', dueDate: 'not-a-date' }, defaultMeta);

    expect(result).toBe('(invalid input: dueDate is not a valid date)');
    const db = ctx.db as unknown as MockDb;
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('wraps task and dependency creation in a transaction', async () => {
    const txCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const txCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'task-1',
      ...data,
    }));
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({ id: 'thread-1', projectId: 'project-1' }),
        },
        userTask: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([{ id: 'dep-1' }]),
        },
        userTaskDependency: { createMany: vi.fn() },
        $transaction: vi
          .fn()
          .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({ userTask: { create: txCreate }, userTaskDependency: { createMany: txCreateMany } }),
          ),
      } as never,
    });

    await addTask(ctx, { title: 'Transacted task', blockedBy: ['dep-1'] }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [{ dependentId: 'task-1', dependsOnId: 'dep-1' }],
      skipDuplicates: true,
    });
  });
});
