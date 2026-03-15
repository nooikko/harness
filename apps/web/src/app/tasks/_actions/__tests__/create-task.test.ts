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
});
