import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    workspacePlan: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    thread: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createWorkspacePlan } = await import('../create-workspace-plan');

describe('createWorkspacePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a workspace plan with objective and empty task graph', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1', projectId: 'proj-1' });
    mockCreate.mockResolvedValue({
      id: 'plan-1',
      threadId: 'thread-1',
      objective: 'Get comprehensive test coverage',
      status: 'planning',
      planData: { tasks: [] },
      maxDepth: 3,
    });

    const result = await createWorkspacePlan({
      threadId: 'thread-1',
      objective: 'Get comprehensive test coverage',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        objective: 'Get comprehensive test coverage',
        status: 'planning',
        planData: { tasks: [] },
        maxDepth: 3,
      },
    });
    expect(result).toEqual({
      success: true,
      id: 'plan-1',
    });
  });

  it('accepts a custom maxDepth', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1', projectId: 'proj-1' });
    mockCreate.mockResolvedValue({
      id: 'plan-2',
      threadId: 'thread-1',
      objective: 'Build feature X',
      status: 'planning',
      planData: { tasks: [] },
      maxDepth: 5,
    });

    await createWorkspacePlan({
      threadId: 'thread-1',
      objective: 'Build feature X',
      maxDepth: 5,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        objective: 'Build feature X',
        status: 'planning',
        planData: { tasks: [] },
        maxDepth: 5,
      },
    });
  });

  it('returns error when threadId is empty', async () => {
    const result = await createWorkspacePlan({
      threadId: '',
      objective: 'Do stuff',
    });

    expect(result).toEqual({ error: 'Thread ID is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when objective is empty', async () => {
    const result = await createWorkspacePlan({
      threadId: 'thread-1',
      objective: '   ',
    });

    expect(result).toEqual({ error: 'Objective is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when thread does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await createWorkspacePlan({
      threadId: 'nonexistent',
      objective: 'Do stuff',
    });

    expect(result).toEqual({ error: 'Thread not found' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('revalidates /chat path after creation', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1', projectId: 'proj-1' });
    mockCreate.mockResolvedValue({
      id: 'plan-1',
      threadId: 'thread-1',
      objective: 'Test',
      status: 'planning',
      planData: { tasks: [] },
      maxDepth: 3,
    });

    await createWorkspacePlan({
      threadId: 'thread-1',
      objective: 'Test',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('propagates prisma errors', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1', projectId: 'proj-1' });
    mockCreate.mockRejectedValue(new Error('Unique constraint violated'));

    const result = await createWorkspacePlan({
      threadId: 'thread-1',
      objective: 'Test',
    });

    expect(result).toEqual({ error: 'Unique constraint violated' });
  });
});
