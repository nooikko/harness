import { describe, expect, it, vi } from 'vitest';

const mockGetValidToken = vi.fn();
vi.mock('@harness/oauth', () => ({
  getValidToken: (...args: unknown[]) => mockGetValidToken(...args),
}));

const { checkOutlookAuth, OUTLOOK_AUTH_ERROR } = await import('../check-outlook-auth');

describe('checkOutlookAuth', () => {
  const ctx = { db: {} } as Parameters<typeof checkOutlookAuth>[0];

  it('returns token when valid Microsoft OAuth token exists', async () => {
    mockGetValidToken.mockResolvedValue('valid-token-123');
    const result = await checkOutlookAuth(ctx);
    expect(result).toBe('valid-token-123');
    expect(mockGetValidToken).toHaveBeenCalledWith('microsoft', ctx.db);
  });

  it('returns null when no Microsoft OAuth token exists', async () => {
    mockGetValidToken.mockRejectedValue(new Error('No token found'));
    const result = await checkOutlookAuth(ctx);
    expect(result).toBeNull();
  });

  it('exports a descriptive auth error message', () => {
    expect(OUTLOOK_AUTH_ERROR).toContain('Outlook is not connected');
    expect(OUTLOOK_AUTH_ERROR).toContain('/admin/integrations');
  });
});
