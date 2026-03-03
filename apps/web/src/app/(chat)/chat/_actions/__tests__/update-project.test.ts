import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    project: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateProject } = await import('../update-project');

describe('updateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a project name', async () => {
    mockUpdate.mockResolvedValue({
      id: 'project-1',
      name: 'New Name',
      description: null,
      instructions: null,
      model: null,
    });

    await updateProject('project-1', { name: 'New Name' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        name: 'New Name',
        description: undefined,
        instructions: undefined,
        model: undefined,
      },
    });
  });

  it('updates multiple fields at once', async () => {
    mockUpdate.mockResolvedValue({
      id: 'project-1',
      name: 'Updated',
      description: 'New desc',
      instructions: 'New instructions',
      model: 'claude-sonnet-4-6',
    });

    await updateProject('project-1', {
      name: 'Updated',
      description: 'New desc',
      instructions: 'New instructions',
      model: 'claude-sonnet-4-6',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        name: 'Updated',
        description: 'New desc',
        instructions: 'New instructions',
        model: 'claude-sonnet-4-6',
      },
    });
  });

  it('returns the updated project', async () => {
    const mockProject = {
      id: 'project-1',
      name: 'Updated',
      description: null,
      instructions: null,
      model: null,
    };
    mockUpdate.mockResolvedValue(mockProject);

    const result = await updateProject('project-1', { name: 'Updated' });

    expect(result).toEqual(mockProject);
  });

  it('revalidates the /chat path after update', async () => {
    mockUpdate.mockResolvedValue({
      id: 'project-1',
      name: 'Updated',
      description: null,
      instructions: null,
      model: null,
    });

    await updateProject('project-1', { name: 'Updated' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('clears model when null is passed', async () => {
    mockUpdate.mockResolvedValue({
      id: 'project-1',
      name: 'Test',
      description: null,
      instructions: null,
      model: null,
    });

    await updateProject('project-1', { name: 'Test', model: null });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        name: 'Test',
        description: undefined,
        instructions: undefined,
        model: null,
      },
    });
  });

  it('propagates errors from prisma', async () => {
    mockUpdate.mockRejectedValue(new Error('Project not found'));

    await expect(updateProject('nonexistent-id', { name: 'Updated' })).rejects.toThrow('Project not found');
  });

  it('wraps non-Error throws with a string fallback', async () => {
    mockUpdate.mockRejectedValue('unexpected string error');

    await expect(updateProject('project-1', { name: 'Updated' })).rejects.toThrow('unexpected string error');
  });
});
