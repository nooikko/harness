import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { removeDependency } from '../remove-dependency';

type CreateMockContext = (overrides?: Record<string, unknown>) => PluginContext;

const createMockContext: CreateMockContext = (overrides = {}) =>
  ({
    db: {
      userTaskDependency: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'dep-1',
          dependentId: 'task-a',
          dependsOnId: 'task-b',
        }),
        delete: vi.fn().mockResolvedValue({ id: 'dep-1' }),
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
  userTaskDependency: {
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe('removeDependency', () => {
  it('returns error when taskId is missing', async () => {
    const ctx = createMockContext();
    const result = await removeDependency(ctx, { blockedById: 'task-b' }, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('returns error when blockedById is missing', async () => {
    const ctx = createMockContext();
    const result = await removeDependency(ctx, { taskId: 'task-a' }, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('returns error when both are missing', async () => {
    const ctx = createMockContext();
    const result = await removeDependency(ctx, {}, defaultMeta);

    expect(result).toBe('(invalid input: taskId and blockedById are required)');
  });

  it('returns not found when dependency does not exist', async () => {
    const ctx = createMockContext({
      db: {
        userTaskDependency: {
          findUnique: vi.fn().mockResolvedValue(null),
          delete: vi.fn(),
        },
      } as never,
    });

    const result = await removeDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    expect(result).toBe('(dependency not found)');
    const db = ctx.db as unknown as MockDb;
    expect(db.userTaskDependency.delete).not.toHaveBeenCalled();
  });

  it('deletes dependency when found', async () => {
    const ctx = createMockContext();
    const result = await removeDependency(ctx, { taskId: 'task-a', blockedById: 'task-b' }, defaultMeta);

    const db = ctx.db as unknown as MockDb;
    expect(db.userTaskDependency.findUnique).toHaveBeenCalledWith({
      where: {
        dependentId_dependsOnId: {
          dependentId: 'task-a',
          dependsOnId: 'task-b',
        },
      },
    });
    expect(db.userTaskDependency.delete).toHaveBeenCalledWith({
      where: { id: 'dep-1' },
    });
    expect(result).toBe('Dependency removed.');
  });
});
