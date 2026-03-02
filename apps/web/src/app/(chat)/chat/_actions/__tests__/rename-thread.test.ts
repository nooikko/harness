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

  it('updates thread name with trimmed value', async () => {
    await renameThread('thread-1', 'My New Name');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { name: 'My New Name' },
    });
  });

  it('trims whitespace from the name before saving', async () => {
    await renameThread('thread-1', '  Padded Name  ');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { name: 'Padded Name' },
    });
  });

  it('does nothing when the trimmed name is empty', async () => {
    await renameThread('thread-1', '   ');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does nothing when the name is an empty string', async () => {
    await renameThread('thread-1', '');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('revalidates the root path after renaming', async () => {
    await renameThread('thread-1', 'New Name');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });
});
