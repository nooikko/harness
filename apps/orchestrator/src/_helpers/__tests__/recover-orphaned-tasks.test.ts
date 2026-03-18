import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverOrphanedTasks } from '../recover-orphaned-tasks';

type MockDb = {
  orchestratorTask: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  thread: {
    update: ReturnType<typeof vi.fn>;
  };
};

const createMocks = () => {
  const db: MockDb = {
    orchestratorTask: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    thread: {
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  return { db, logger };
};

describe('recoverOrphanedTasks', () => {
  let db: MockDb;
  let logger: Logger;

  beforeEach(() => {
    const mocks = createMocks();
    db = mocks.db;
    logger = mocks.logger;
  });

  it('returns 0 and does nothing when no orphaned tasks exist', async () => {
    db.orchestratorTask.findMany.mockResolvedValue([]);

    const count = await recoverOrphanedTasks(db as never, logger);

    expect(count).toBe(0);
    expect(db.orchestratorTask.update).not.toHaveBeenCalled();
    expect(db.thread.update).not.toHaveBeenCalled();
  });

  it('queries for tasks with status running, evaluating, or pending and old updatedAt', async () => {
    db.orchestratorTask.findMany.mockResolvedValue([]);

    await recoverOrphanedTasks(db as never, logger);

    expect(db.orchestratorTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['running', 'evaluating', 'pending'] },
          updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('marks each orphaned task as failed', async () => {
    const orphaned = [
      { id: 'task-1', threadId: 'thread-1', currentIteration: 2, maxIterations: 5 },
      { id: 'task-2', threadId: 'thread-2', currentIteration: 1, maxIterations: 3 },
    ];
    db.orchestratorTask.findMany.mockResolvedValue(orphaned);

    await recoverOrphanedTasks(db as never, logger);

    expect(db.orchestratorTask.update).toHaveBeenCalledTimes(2);
    expect(db.orchestratorTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { status: 'failed' },
    });
    expect(db.orchestratorTask.update).toHaveBeenCalledWith({
      where: { id: 'task-2' },
      data: { status: 'failed' },
    });
  });

  it('marks the task thread as failed with updated lastActivity', async () => {
    const orphaned = [{ id: 'task-1', threadId: 'thread-1', currentIteration: 3, maxIterations: 5 }];
    db.orchestratorTask.findMany.mockResolvedValue(orphaned);

    await recoverOrphanedTasks(db as never, logger);

    expect(db.thread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { status: 'failed', lastActivity: expect.any(Date) },
    });
  });

  it('returns the count of recovered tasks', async () => {
    const orphaned = [
      { id: 'task-1', threadId: 'thread-1', currentIteration: 1, maxIterations: 5 },
      { id: 'task-2', threadId: 'thread-2', currentIteration: 2, maxIterations: 5 },
      { id: 'task-3', threadId: 'thread-3', currentIteration: 5, maxIterations: 5 },
    ];
    db.orchestratorTask.findMany.mockResolvedValue(orphaned);

    const count = await recoverOrphanedTasks(db as never, logger);

    expect(count).toBe(3);
  });

  it('logs a warning for each recovered task', async () => {
    const orphaned = [{ id: 'task-1', threadId: 'thread-1', currentIteration: 2, maxIterations: 5 }];
    db.orchestratorTask.findMany.mockResolvedValue(orphaned);

    await recoverOrphanedTasks(db as never, logger);

    expect(logger.warn).toHaveBeenCalledWith('Recovered orphaned task', expect.objectContaining({ taskId: 'task-1', threadId: 'thread-1' }));
  });
});
