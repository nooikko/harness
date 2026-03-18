import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectVirtualEvents } from '../project-virtual-events';

const mockMemoryFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
const mockCronFindMany = vi.fn();
const mockUpsert = vi.fn();

const ctx = {
  db: {
    agentMemory: { findMany: mockMemoryFindMany },
    userTask: { findMany: mockTaskFindMany },
    cronJob: { findMany: mockCronFindMany },
    calendarEvent: { upsert: mockUpsert },
  },
  logger: { info: vi.fn() },
} as unknown as Parameters<typeof projectVirtualEvents>[0];

describe('projectVirtualEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projects memories as MEMORY source events', async () => {
    mockMemoryFindMany.mockResolvedValue([{ id: 'mem-1', content: 'Important insight', createdAt: new Date('2026-03-17T12:00:00Z') }]);
    mockTaskFindMany.mockResolvedValue([]);
    mockCronFindMany.mockResolvedValue([]);

    await projectVirtualEvents(ctx);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: 'MEMORY', externalId: 'mem-1' } },
        create: expect.objectContaining({ source: 'MEMORY', title: 'Important insight' }),
      }),
    );
  });

  it('projects tasks with due dates as TASK source events', async () => {
    mockMemoryFindMany.mockResolvedValue([]);
    const dueDate = new Date('2026-03-20T17:00:00Z');
    mockTaskFindMany.mockResolvedValue([{ id: 'task-1', title: 'Ship feature', dueDate, priority: 'HIGH' }]);
    mockCronFindMany.mockResolvedValue([]);

    await projectVirtualEvents(ctx);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: 'TASK', externalId: 'task-1' } },
        create: expect.objectContaining({ source: 'TASK', title: 'Ship feature' }),
      }),
    );
  });

  it('skips tasks with null dueDate', async () => {
    mockMemoryFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([{ id: 'task-2', title: 'No date', dueDate: null, priority: 'LOW' }]);
    mockCronFindMany.mockResolvedValue([]);

    await projectVirtualEvents(ctx);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('projects enabled cron jobs as CRON source events', async () => {
    mockMemoryFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    const nextRunAt = new Date('2026-03-18T14:00:00Z');
    mockCronFindMany.mockResolvedValue([{ id: 'cron-1', name: 'Morning Digest', nextRunAt }]);

    await projectVirtualEvents(ctx);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: 'CRON', externalId: 'cron-1' } },
        create: expect.objectContaining({ source: 'CRON', title: 'Morning Digest' }),
      }),
    );
  });

  it('skips cron jobs with null nextRunAt', async () => {
    mockMemoryFindMany.mockResolvedValue([]);
    mockTaskFindMany.mockResolvedValue([]);
    mockCronFindMany.mockResolvedValue([{ id: 'cron-2', name: 'Disabled', nextRunAt: null }]);

    await projectVirtualEvents(ctx);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('truncates long memory content to 80 chars', async () => {
    const longContent = 'A'.repeat(100);
    mockMemoryFindMany.mockResolvedValue([{ id: 'mem-long', content: longContent, createdAt: new Date() }]);
    mockTaskFindMany.mockResolvedValue([]);
    mockCronFindMany.mockResolvedValue([]);

    await projectVirtualEvents(ctx);

    const createArg = mockUpsert.mock.calls[0]![0] as { create: { title: string } };
    expect(createArg.create.title).toHaveLength(80);
    expect(createArg.create.title).toMatch(/\.\.\.$/);
  });
});
