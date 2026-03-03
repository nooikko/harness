import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindManyCronJobs = vi.fn();
const mockFindManyThreads = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    cronJob: {
      findMany: (...args: unknown[]) => mockFindManyCronJobs(...args),
    },
    thread: {
      findMany: (...args: unknown[]) => mockFindManyThreads(...args),
    },
  },
}));

const { listCronJobs } = await import('../list-cron-jobs');

describe('listCronJobs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns an empty array when there are no cron jobs', async () => {
    mockFindManyCronJobs.mockResolvedValue([]);

    const result = await listCronJobs();

    expect(result).toEqual([]);
    // Should NOT query threads when there are no threadIds
    expect(mockFindManyThreads).not.toHaveBeenCalled();
  });

  it('maps job fields correctly including agent and project names', async () => {
    const now = new Date('2026-03-01T12:00:00Z');
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Daily Digest',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'Summarize activity',
        enabled: true,
        lastRunAt: now,
        nextRunAt: now,
        threadId: null,
        agentId: 'agent_1',
        projectId: 'proj_1',
        createdAt: now,
        updatedAt: now,
        agent: { name: 'Claude' },
        project: { name: 'Main Project' },
      },
    ]);

    const result = await listCronJobs();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'cj_1',
      name: 'Daily Digest',
      schedule: '0 9 * * *',
      fireAt: null,
      prompt: 'Summarize activity',
      enabled: true,
      lastRunAt: now,
      nextRunAt: now,
      threadId: null,
      threadName: null,
      agentName: 'Claude',
      projectName: 'Main Project',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('queries threads and maps threadName when jobs have threadIds', async () => {
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Job 1',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: 'thread_1',
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
    ]);
    mockFindManyThreads.mockResolvedValue([{ id: 'thread_1', name: 'My Thread' }]);

    const result = await listCronJobs();

    expect(mockFindManyThreads).toHaveBeenCalledWith({
      where: { id: { in: ['thread_1'] } },
      select: { id: true, name: true },
    });
    expect(result[0]?.threadName).toBe('My Thread');
  });

  it('returns null threadName when thread has no name in the map', async () => {
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Job 1',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: 'thread_orphan',
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
    ]);
    // Thread not found in DB
    mockFindManyThreads.mockResolvedValue([]);

    const result = await listCronJobs();

    expect(result[0]?.threadName).toBeNull();
  });

  it('returns null projectName when project is null', async () => {
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Job 1',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
    ]);

    const result = await listCronJobs();

    expect(result[0]?.projectName).toBeNull();
  });

  it('does not query threads when all threadIds are null', async () => {
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Job 1',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
    ]);

    await listCronJobs();

    expect(mockFindManyThreads).not.toHaveBeenCalled();
  });

  it('filters out null threadIds before querying threads', async () => {
    mockFindManyCronJobs.mockResolvedValue([
      {
        id: 'cj_1',
        name: 'Job 1',
        schedule: '0 9 * * *',
        fireAt: null,
        prompt: 'test',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: 'thread_1',
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
      {
        id: 'cj_2',
        name: 'Job 2',
        schedule: '0 10 * * *',
        fireAt: null,
        prompt: 'test2',
        enabled: true,
        lastRunAt: null,
        nextRunAt: null,
        threadId: null,
        agentId: 'agent_1',
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agent: { name: 'Agent' },
        project: null,
      },
    ]);
    mockFindManyThreads.mockResolvedValue([{ id: 'thread_1', name: 'Thread One' }]);

    const result = await listCronJobs();

    expect(mockFindManyThreads).toHaveBeenCalledWith({
      where: { id: { in: ['thread_1'] } },
      select: { id: true, name: true },
    });
    expect(result[0]?.threadName).toBe('Thread One');
    expect(result[1]?.threadName).toBeNull();
  });
});
