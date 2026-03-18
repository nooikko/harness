import { describe, expect, it, vi } from 'vitest';
import { resolveOrCreateThread } from '../resolve-or-create-thread';

type MockDb = {
  thread: {
    create: ReturnType<typeof vi.fn>;
  };
  cronJob: {
    update: ReturnType<typeof vi.fn>;
  };
};

type CreateMockDb = () => MockDb;

const createMockDb: CreateMockDb = () => ({
  thread: {
    create: vi.fn().mockResolvedValue({ id: 'new-thread-id' }),
  },
  cronJob: {
    update: vi.fn().mockResolvedValue(undefined),
  },
});

describe('resolveOrCreateThread', () => {
  it('returns the existing threadId immediately when job.threadId is set', async () => {
    const db = createMockDb();

    const result = await resolveOrCreateThread(db as never, {
      id: 'job-1',
      threadId: 'existing-thread',
      agentId: 'agent-1',
      projectId: null,
      name: 'Test Job',
    });

    expect(result).toBe('existing-thread');
    expect(db.thread.create).not.toHaveBeenCalled();
    expect(db.cronJob.update).not.toHaveBeenCalled();
  });

  it('creates a new thread and updates the cronJob when threadId is null', async () => {
    const db = createMockDb();

    const result = await resolveOrCreateThread(db as never, {
      id: 'job-2',
      threadId: null,
      agentId: 'agent-2',
      projectId: 'project-1',
      name: 'New Thread Job',
    });

    expect(result).toBe('new-thread-id');
    expect(db.thread.create).toHaveBeenCalledWith({
      data: {
        source: 'cron',
        sourceId: 'cron-job-2',
        kind: 'cron',
        name: 'New Thread Job',
        agentId: 'agent-2',
        projectId: 'project-1',
      },
    });
    expect(db.cronJob.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: { threadId: 'new-thread-id' },
    });
  });

  it('passes undefined for projectId when job.projectId is null', async () => {
    const db = createMockDb();

    await resolveOrCreateThread(db as never, {
      id: 'job-3',
      threadId: null,
      agentId: 'agent-3',
      projectId: null,
      name: 'Null Project Job',
    });

    expect(db.thread.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: undefined,
      }),
    });
  });

  it('propagates error when db.thread.create throws', async () => {
    const db = createMockDb();
    db.thread.create.mockRejectedValueOnce(new Error('unique constraint on sourceId'));

    await expect(
      resolveOrCreateThread(db as never, {
        id: 'job-4',
        threadId: null,
        agentId: 'agent-4',
        projectId: null,
        name: 'Create Fail Job',
      }),
    ).rejects.toThrow('unique constraint on sourceId');

    // cronJob.update should NOT have been called since thread.create failed
    expect(db.cronJob.update).not.toHaveBeenCalled();
  });

  it('propagates error when db.cronJob.update throws after thread creation', async () => {
    const db = createMockDb();
    db.cronJob.update.mockRejectedValueOnce(new Error('update failed'));

    await expect(
      resolveOrCreateThread(db as never, {
        id: 'job-5',
        threadId: null,
        agentId: 'agent-5',
        projectId: null,
        name: 'Update Fail Job',
      }),
    ).rejects.toThrow('update failed');

    // thread.create should have been called successfully
    expect(db.thread.create).toHaveBeenCalledOnce();
  });
});
