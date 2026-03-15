import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { listTasks } from '../list-tasks';

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
        findMany: vi.fn().mockResolvedValue([]),
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
    ...overrides,
  }) as never;

const defaultMeta: PluginToolMeta = {
  threadId: 'thread-1',
};

type MockDb = {
  thread: { findUnique: ReturnType<typeof vi.fn> };
  userTask: { findMany: ReturnType<typeof vi.fn> };
};

describe('listTasks', () => {
  it('returns no tasks found when empty', async () => {
    const ctx = createMockContext();
    const result = await listTasks(ctx, {}, defaultMeta);

    expect(result).toBe('(no tasks found)');
  });

  it('formats tasks with status, title, priority, and id', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: 'project-1',
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'task-1',
              title: 'Fix bug',
              status: 'TODO',
              priority: 'HIGH',
              dueDate: null,
              project: { name: 'My Project' },
              blockedBy: [],
            },
          ]),
        },
      } as never,
    });

    const result = await listTasks(ctx, {}, defaultMeta);

    expect(result).toContain('[TODO]');
    expect(result).toContain('Fix bug');
    expect(result).toContain('HIGH');
    expect(result).toContain('id:task-1');
    expect(result).toContain('[My Project]');
  });

  it('shows [global] for tasks with no project', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: 'project-1',
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'task-2',
              title: 'Global task',
              status: 'TODO',
              priority: 'MEDIUM',
              dueDate: null,
              project: null,
              blockedBy: [],
            },
          ]),
        },
      } as never,
    });

    const result = await listTasks(ctx, {}, defaultMeta);

    expect(result).toContain('[global]');
  });

  it('shows due date when present', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: 'project-1',
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'task-3',
              title: 'Due soon',
              status: 'IN_PROGRESS',
              priority: 'URGENT',
              dueDate: new Date('2099-06-15T00:00:00Z'),
              project: { name: 'Proj' },
              blockedBy: [],
            },
          ]),
        },
      } as never,
    });

    const result = await listTasks(ctx, {}, defaultMeta);

    expect(result).toContain('due:2099-06-15');
  });

  it('shows blocked-by info when dependencies exist', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: 'project-1',
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'task-4',
              title: 'Blocked task',
              status: 'TODO',
              priority: 'LOW',
              dueDate: null,
              project: null,
              blockedBy: [
                { dependsOn: { id: 'dep-1', title: 'Setup DB', status: 'TODO' } },
                { dependsOn: { id: 'dep-2', title: 'Write API', status: 'IN_PROGRESS' } },
              ],
            },
          ]),
        },
      } as never,
    });

    const result = await listTasks(ctx, {}, defaultMeta);

    expect(result).toContain('blocked-by:[Setup DB, Write API]');
  });

  it('auto-resolves projectId from thread when not provided', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.thread.findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { projectId: true },
    });
  });

  it('uses explicit projectId when provided', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, { projectId: 'explicit-proj' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.thread.findUnique).not.toHaveBeenCalled();
  });

  it('builds OR filter for project scoping with includeGlobal true (default)', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({
      OR: [{ projectId: 'project-1' }, { projectId: null }],
    });
  });

  it('excludes global tasks when includeGlobal is false', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, { includeGlobal: false }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({ projectId: 'project-1' });
  });

  it('applies status filter when valid status provided', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, { status: 'IN_PROGRESS' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.where.status).toBe('IN_PROGRESS');
  });

  it('ignores invalid status filter', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, { status: 'INVALID' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.where.status).toBeUndefined();
  });

  it('applies no project filter when thread has no project', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: null,
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as never,
    });

    await listTasks(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    // No OR filter, no projectId filter — empty object spread
    expect(call.where.OR).toBeUndefined();
    expect(call.where.projectId).toBeUndefined();
  });

  it('limits results to 50', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.take).toBe(50);
  });

  it('includes blockedBy and project in the query', async () => {
    const ctx = createMockContext();
    await listTasks(ctx, {}, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    const call = db.userTask.findMany.mock.calls[0]?.[0];
    expect(call.include.blockedBy).toBeDefined();
    expect(call.include.project).toBeDefined();
  });

  it('formats multiple tasks as newline-separated lines', async () => {
    const ctx = createMockContext({
      db: {
        thread: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'thread-1',
            projectId: 'project-1',
          }),
        },
        userTask: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 't1',
              title: 'First',
              status: 'TODO',
              priority: 'HIGH',
              dueDate: null,
              project: null,
              blockedBy: [],
            },
            {
              id: 't2',
              title: 'Second',
              status: 'DONE',
              priority: 'LOW',
              dueDate: null,
              project: null,
              blockedBy: [],
            },
          ]),
        },
      } as never,
    });

    const result = await listTasks(ctx, {}, defaultMeta);
    const lines = result.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('First');
    expect(lines[1]).toContain('Second');
  });
});
