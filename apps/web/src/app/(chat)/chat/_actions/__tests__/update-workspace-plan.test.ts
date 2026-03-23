import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    workspacePlan: {
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateWorkspacePlan } = await import('../update-workspace-plan');

describe('updateWorkspacePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates plan status', async () => {
    mockFindUnique.mockResolvedValue({ id: 'plan-1', status: 'planning' });
    mockUpdate.mockResolvedValue({
      id: 'plan-1',
      status: 'active',
      planData: { tasks: [] },
    });

    const result = await updateWorkspacePlan({
      planId: 'plan-1',
      status: 'active',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { status: 'active' },
    });
    expect(result).toEqual({ success: true });
  });

  it('updates planData', async () => {
    const newPlanData = {
      tasks: [
        {
          id: 't1',
          title: 'Write unit tests',
          description: 'Cover delegation plugin',
          status: 'pending',
          dependsOn: [],
          acceptanceCriteria: '80%+ coverage',
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        },
      ],
    };

    mockFindUnique.mockResolvedValue({ id: 'plan-1', status: 'active' });
    mockUpdate.mockResolvedValue({
      id: 'plan-1',
      status: 'active',
      planData: newPlanData,
    });

    const result = await updateWorkspacePlan({
      planId: 'plan-1',
      planData: newPlanData,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { planData: newPlanData },
    });
    expect(result).toEqual({ success: true });
  });

  it('updates both status and planData at once', async () => {
    const planData = { tasks: [] };
    mockFindUnique.mockResolvedValue({ id: 'plan-1', status: 'active' });
    mockUpdate.mockResolvedValue({
      id: 'plan-1',
      status: 'completed',
      planData,
    });

    const result = await updateWorkspacePlan({
      planId: 'plan-1',
      status: 'completed',
      planData,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { status: 'completed', planData },
    });
    expect(result).toEqual({ success: true });
  });

  it('returns error when planId is empty', async () => {
    const result = await updateWorkspacePlan({
      planId: '',
      status: 'active',
    });

    expect(result).toEqual({ error: 'Plan ID is required' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when plan does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateWorkspacePlan({
      planId: 'nonexistent',
      status: 'active',
    });

    expect(result).toEqual({ error: 'Plan not found' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when no fields to update', async () => {
    const result = await updateWorkspacePlan({
      planId: 'plan-1',
    });

    expect(result).toEqual({ error: 'No fields to update' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('validates status values', async () => {
    const result = await updateWorkspacePlan({
      planId: 'plan-1',
      status: 'invalid-status' as 'active',
    });

    expect(result).toEqual({ error: 'Invalid status' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('revalidates /chat path after update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'plan-1', status: 'planning' });
    mockUpdate.mockResolvedValue({
      id: 'plan-1',
      status: 'active',
      planData: { tasks: [] },
    });

    await updateWorkspacePlan({
      planId: 'plan-1',
      status: 'active',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('propagates prisma errors', async () => {
    mockFindUnique.mockResolvedValue({ id: 'plan-1', status: 'active' });
    mockUpdate.mockRejectedValue(new Error('DB error'));

    const result = await updateWorkspacePlan({
      planId: 'plan-1',
      status: 'completed',
    });

    expect(result).toEqual({ error: 'DB error' });
  });
});
