import { describe, expect, it, vi } from 'vitest';

const mockDeleteMany = vi.fn();
const mockDb = {
  oAuthToken: {
    deleteMany: mockDeleteMany,
  },
} as never;

describe('revokeToken', () => {
  it('deletes token records for the given provider and accountId', async () => {
    const { revokeToken } = await import('../revoke-token');
    mockDeleteMany.mockResolvedValue({ count: 1 });

    await revokeToken('microsoft', 'user-123', mockDb);

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { provider: 'microsoft', accountId: 'user-123' },
    });
  });
});
