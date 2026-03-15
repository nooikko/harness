import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTask: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createTask } = await import('../create-task');

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task and returns the result', async () => {
    const mockTask = {
      id: 'task-1',
      title: 'Buy groceries',
      status: 'TODO',
      priority: 'MEDIUM',
    };
    mockCreate.mockResolvedValue(mockTask);

    const result = await createTask({ title: 'Buy groceries' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: 'Buy groceries',
        description: undefined,
        priority: undefined,
        dueDate: undefined,
        projectId: undefined,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
    });
    expect(result).toEqual(mockTask);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('passes all optional fields through', async () => {
    mockCreate.mockResolvedValue({
      id: 'task-2',
      title: 'Deploy',
      status: 'TODO',
      priority: 'HIGH',
    });
    const dueDate = new Date('2026-04-01');

    await createTask({
      title: 'Deploy',
      description: 'Ship it',
      priority: 'HIGH',
      dueDate,
      projectId: 'proj-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: 'Deploy',
        description: 'Ship it',
        priority: 'HIGH',
        dueDate,
        projectId: 'proj-1',
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
    });
  });

  it('throws when prisma.userTask.create fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(createTask({ title: 'Fail task' })).rejects.toThrow('DB connection lost');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('passes dueDate as ISO string converted to Date and projectId', async () => {
    const dueDate = new Date('2026-06-15T09:00:00.000Z');
    mockCreate.mockResolvedValue({
      id: 'task-3',
      title: 'Review PR',
      status: 'TODO',
      priority: 'LOW',
    });

    const result = await createTask({
      title: 'Review PR',
      description: 'Check the diff',
      priority: 'LOW',
      dueDate,
      projectId: 'proj-42',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: 'Review PR',
        description: 'Check the diff',
        priority: 'LOW',
        dueDate,
        projectId: 'proj-42',
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
    });
    expect(result).toEqual({
      id: 'task-3',
      title: 'Review PR',
      status: 'TODO',
      priority: 'LOW',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });
});
