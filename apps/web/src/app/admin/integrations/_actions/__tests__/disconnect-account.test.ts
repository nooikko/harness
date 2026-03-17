import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevokeToken = vi.fn();
vi.mock('@harness/oauth', () => ({
  revokeToken: mockRevokeToken,
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('@harness/database', () => ({
  prisma: { mockPrisma: true },
}));

const { disconnectAccount } = await import('../disconnect-account');

describe('disconnectAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes token and revalidates integrations page', async () => {
    mockRevokeToken.mockResolvedValue(undefined);

    await disconnectAccount('microsoft', 'account-123');

    expect(mockRevokeToken).toHaveBeenCalledWith('microsoft', 'account-123', { mockPrisma: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/integrations');
  });

  it('propagates errors from revokeToken', async () => {
    mockRevokeToken.mockRejectedValue(new Error('Token not found'));

    await expect(disconnectAccount('microsoft', 'bad-id')).rejects.toThrow('Token not found');
  });
});
