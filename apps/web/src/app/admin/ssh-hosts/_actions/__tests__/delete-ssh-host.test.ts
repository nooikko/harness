import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => mockLogServerError(...args),
}));

const { deleteSshHost } = await import('../delete-ssh-host');

describe('deleteSshHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the host with the given id', async () => {
    mockDelete.mockResolvedValue({ id: 'host-1' });

    await deleteSshHost('host-1');

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'host-1' } });
  });

  it('returns success: true on successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'host-1' });

    const result = await deleteSshHost('host-1');

    expect(result).toEqual({ success: true });
  });

  it('revalidates /admin/ssh-hosts after successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'host-1' });

    await deleteSshHost('host-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ssh-hosts');
  });

  it('returns error message when prisma throws', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    const result = await deleteSshHost('host-1');

    expect(result).toEqual({ error: 'Failed to delete SSH host' });
  });

  it('logs the error when deletion fails', async () => {
    const dbError = new Error('DB error');
    mockDelete.mockRejectedValue(dbError);

    await deleteSshHost('host-1');

    expect(mockLogServerError).toHaveBeenCalledWith(expect.objectContaining({ action: 'deleteSshHost', error: dbError }));
  });

  it('does not revalidate when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    await deleteSshHost('host-1');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
