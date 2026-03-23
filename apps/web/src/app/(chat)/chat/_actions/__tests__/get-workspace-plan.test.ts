import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    workspacePlan: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

const { getWorkspacePlan } = await import('../get-workspace-plan');

describe('getWorkspacePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a workspace plan by threadId', async () => {
    const plan = {
      id: 'plan-1',
      threadId: 'thread-1',
      objective: 'Test coverage',
      status: 'active',
      planData: { tasks: [{ id: 't1', title: 'Write tests', status: 'pending' }] },
      maxDepth: 3,
      createdAt: new Date('2026-03-22'),
      updatedAt: new Date('2026-03-22'),
    };
    mockFindUnique.mockResolvedValue(plan);

    const result = await getWorkspacePlan('thread-1');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
    });
    expect(result).toEqual(plan);
  });

  it('returns null when no plan exists for the thread', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getWorkspacePlan('thread-no-plan');

    expect(result).toBeNull();
  });

  it('returns null for empty threadId', async () => {
    const result = await getWorkspacePlan('');

    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
