import { describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn().mockResolvedValue({});
vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { updateThreadPermissionMode } = await import('../update-thread-permission-mode');

describe('updateThreadPermissionMode', () => {
  it('updates thread with the given permission mode', async () => {
    await updateThreadPermissionMode('thread-1', 'allowEditing');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { permissionMode: 'allowEditing' },
    });
  });

  it('sets permissionMode to null when passed null', async () => {
    await updateThreadPermissionMode('thread-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { permissionMode: null },
    });
  });

  it('calls revalidatePath after update', async () => {
    const { revalidatePath } = await import('next/cache');
    await updateThreadPermissionMode('thread-1', 'default');

    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});
