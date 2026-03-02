import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { renameThread } = await import('../rename-thread');

describe('renameThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('updates the thread name with trimmed value', async () => {
    await renameThread('thread-1', '  New Name  ');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { name: 'New Name' },
    });
  });

  it('revalidates the root path after updating', async () => {
    await renameThread('thread-1', 'New Name');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('does nothing when name is empty after trim', async () => {
    await renameThread('thread-1', '   ');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does nothing when name is empty string', async () => {
    await renameThread('thread-1', '');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
