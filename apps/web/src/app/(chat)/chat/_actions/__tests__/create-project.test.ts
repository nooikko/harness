import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    project: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createProject } = await import('../create-project');

describe('createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a project with the given name', async () => {
    mockCreate.mockResolvedValue({
      id: 'project-1',
      name: 'My Project',
      description: null,
      instructions: null,
      model: null,
    });

    await createProject({ name: 'My Project' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'My Project',
        description: undefined,
        instructions: undefined,
        model: undefined,
      },
    });
  });

  it('creates a project with all optional fields', async () => {
    mockCreate.mockResolvedValue({
      id: 'project-2',
      name: 'Full Project',
      description: 'A description',
      instructions: 'Some instructions',
      model: 'claude-opus-4-6',
    });

    await createProject({
      name: 'Full Project',
      description: 'A description',
      instructions: 'Some instructions',
      model: 'claude-opus-4-6',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Full Project',
        description: 'A description',
        instructions: 'Some instructions',
        model: 'claude-opus-4-6',
      },
    });
  });

  it('returns the created project', async () => {
    const mockProject = {
      id: 'project-1',
      name: 'My Project',
      description: null,
      instructions: null,
      model: null,
    };
    mockCreate.mockResolvedValue(mockProject);

    const result = await createProject({ name: 'My Project' });

    expect(result).toEqual(mockProject);
  });

  it('revalidates the /chat path after creation', async () => {
    mockCreate.mockResolvedValue({
      id: 'project-1',
      name: 'My Project',
      description: null,
      instructions: null,
      model: null,
    });

    await createProject({ name: 'My Project' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('propagates errors from prisma', async () => {
    mockCreate.mockRejectedValue(new Error('Database error'));

    await expect(createProject({ name: 'My Project' })).rejects.toThrow('Database error');
  });
});
