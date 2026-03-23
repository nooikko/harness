import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { addDependency } from '../add-dependency';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      userTask: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'task-a') {
            return Promise.resolve({ id: 'task-a', title: 'Task A' });
          }
          if (where.id === 'task-b') {
            return Promise.resolve({ id: 'task-b', title: 'Task B' });
          }
          return Promise.resolve(null);
        }),
      },
      userTaskDependency: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'dep-1' }),
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
    reportBackgroundError: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = {
  threadId: 'thread-1',
};

type MockDb = {
  userTask: { findUnique: ReturnType<typeof vi.fn> };
  userTaskDependency: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe('addDependency', () => {
  it('returns error when taskId is missing', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { blockedById: 'task-b' }, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('returns error when blockedById is missing', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { taskId: 'task-a' }, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('returns error when both are missing', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, {}, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('rejects self-reference', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-a' }, defaultMeta);

    expect(result).toBe('(a task cannot block itself)');
  });

  it('returns error when task not found', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { taskId: 'missing', blockedById: 'task-b' }, defaultMeta);

    expect(result).toBe('(task not found: missing)');
  });

  it('returns error when blocker task not found', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'missing' }, defaultMeta);

    expect(result).toBe('(blocker task not found: missing)');
  });

  it('creates dependency when no cycle exists', async () => {
    const ctx = createMockContext();
    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTaskDependency.create).toHaveBeenCalledWith({
      data: { dependentId: 'task-a', dependsOnId: 'task-b' },
    });
    expect(result).toContain('Dependency added');
    expect(result).toContain('Task A');
    expect(result).toContain('Task B');
  });

  it('detects direct cycle (B already depends on A)', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-b') {
              return Promise.resolve({ id: 'task-b', title: 'Task B' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          // B depends on A — so adding A->B would create a cycle
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.dependentId === 'task-b') {
              return Promise.resolve([{ dependsOnId: 'task-a' }]);
            }
            return Promise.resolve([]);
          }),
          create: vi.fn(),
        },
      } as never,
    });

    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    expect(result).toContain('cycle');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTaskDependency.create).not.toHaveBeenCalled();
  });

  it('detects transitive cycle (C->B->A, adding A->C)', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-c') {
              return Promise.resolve({ id: 'task-c', title: 'Task C' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          // C depends on B, B depends on A
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.dependentId === 'task-c') {
              return Promise.resolve([{ dependsOnId: 'task-b' }]);
            }
            if (where.dependentId === 'task-b') {
              return Promise.resolve([{ dependsOnId: 'task-a' }]);
            }
            return Promise.resolve([]);
          }),
          create: vi.fn(),
        },
      } as never,
    });

    // Adding task-a blocked by task-c: would create A->C->B->A cycle
    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-c' }, defaultMeta);

    expect(result).toContain('cycle');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTaskDependency.create).not.toHaveBeenCalled();
  });

  it('allows dependency when no cycle path exists', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-b') {
              return Promise.resolve({ id: 'task-b', title: 'Task B' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          // B depends on C (not on A), so A->B is safe
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.dependentId === 'task-b') {
              return Promise.resolve([{ dependsOnId: 'task-c' }]);
            }
            if (where.dependentId === 'task-c') {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          }),
          create: vi.fn().mockResolvedValue({ id: 'dep-1' }),
        },
      } as never,
    });

    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    expect(result).toContain('Dependency added');
  });

  it('returns friendly message when dependency already exists (P2002)', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-b') {
              return Promise.resolve({ id: 'task-b', title: 'Task B' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })),
        },
      } as never,
    });

    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    expect(result).toContain('already exists');
    expect(result).toContain('Task A');
    expect(result).toContain('Task B');
  });

  it('returns friendly message when a task is deleted during create (P2003)', async () => {
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-b') {
              return Promise.resolve({ id: 'task-b', title: 'Task B' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockRejectedValue(Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' })),
        },
      } as never,
    });

    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    expect(result).toContain('task not found');
  });

  it('BFS visited guard prevents redundant traversal in diamond dependency graph', async () => {
    // Diamond: X is blocked by B and C; both B and C are blocked by D
    // Adding A→X (A blocked by X) should succeed with no cycle
    // Without the visited guard, D would be queued and traversed twice
    const findMany = vi.fn().mockImplementation(({ where }: { where: { dependentId: string } }) => {
      if (where.dependentId === 'task-x') {
        return Promise.resolve([{ dependsOnId: 'task-b' }, { dependsOnId: 'task-c' }]);
      }
      if (where.dependentId === 'task-b') {
        return Promise.resolve([{ dependsOnId: 'task-d' }]);
      }
      if (where.dependentId === 'task-c') {
        return Promise.resolve([{ dependsOnId: 'task-d' }]);
      }
      return Promise.resolve([]);
    });
    const create = vi.fn().mockResolvedValue({ id: 'dep-new' });
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            const tasks: Record<string, { id: string; title: string }> = {
              'task-a': { id: 'task-a', title: 'Task A' },
              'task-x': { id: 'task-x', title: 'Task X' },
            };
            return Promise.resolve(tasks[where.id] ?? null);
          }),
        },
        userTaskDependency: { findMany, create },
      } as never,
    });

    // A→X: X cannot reach A through the diamond, so no cycle
    const result = await addDependency(ctx, { taskId: 'task-a', blockedById: 'task-x' }, defaultMeta);

    expect(result).toContain('Dependency added');
    // D should only be traversed once despite being reachable via both B and C
    const dCalls = findMany.mock.calls.filter((args: [{ where: { dependentId: string } }]) => args[0]?.where.dependentId === 'task-d');
    expect(dCalls).toHaveLength(1);
  });

  it('rethrows unknown errors from dependency create', async () => {
    const unknownError = new Error('Database connection lost');
    const ctx = createMockContext({
      db: {
        userTask: {
          findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
            if (where.id === 'task-a') {
              return Promise.resolve({ id: 'task-a', title: 'Task A' });
            }
            if (where.id === 'task-b') {
              return Promise.resolve({ id: 'task-b', title: 'Task B' });
            }
            return Promise.resolve(null);
          }),
        },
        userTaskDependency: {
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockRejectedValue(unknownError),
        },
      } as never,
    });

    await expect(addDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta)).rejects.toThrow('Database connection lost');
  });
});
