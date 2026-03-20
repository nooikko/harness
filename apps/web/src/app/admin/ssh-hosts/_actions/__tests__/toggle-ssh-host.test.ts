import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    sshHost: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { toggleSshHost } = await import('../toggle-ssh-host');

describe('toggleSshHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('looks up the current host by id', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 'host-1', enabled: true });
    mockUpdate.mockResolvedValue({});

    await toggleSshHost('host-1');

    expect(mockFindUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'host-1' } });
  });

  it('disables a currently-enabled host', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 'host-1', enabled: true });
    mockUpdate.mockResolvedValue({});

    await toggleSshHost('host-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'host-1' },
      data: { enabled: false },
    });
  });

  it('enables a currently-disabled host', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 'host-1', enabled: false });
    mockUpdate.mockResolvedValue({});

    await toggleSshHost('host-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'host-1' },
      data: { enabled: true },
    });
  });

  it('revalidates /admin/ssh-hosts after toggle', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({ id: 'host-1', enabled: true });
    mockUpdate.mockResolvedValue({});

    await toggleSshHost('host-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/ssh-hosts');
  });

  it('propagates error when host is not found', async () => {
    mockFindUniqueOrThrow.mockRejectedValue(new Error('No SshHost found'));

    await expect(toggleSshHost('missing-id')).rejects.toThrow('No SshHost found');
  });
});
