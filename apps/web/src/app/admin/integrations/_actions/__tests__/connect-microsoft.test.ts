import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: mockSet }),
}));

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

const mockStartOAuthFlow = vi.fn();
vi.mock('@harness/oauth', () => ({
  startOAuthFlow: mockStartOAuthFlow,
}));

const { connectMicrosoft } = await import('../connect-microsoft');

describe('connectMicrosoft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts OAuth flow and redirects to auth URL', async () => {
    mockStartOAuthFlow.mockReturnValue({
      authUrl: 'https://login.microsoftonline.com/authorize?code=123',
      state: 'random-state-value',
    });

    await connectMicrosoft();

    expect(mockStartOAuthFlow).toHaveBeenCalledWith('microsoft');
    expect(mockRedirect).toHaveBeenCalledWith('https://login.microsoftonline.com/authorize?code=123');
  });

  it('sets oauth_state cookie with correct options', async () => {
    mockStartOAuthFlow.mockReturnValue({
      authUrl: 'https://example.com/auth',
      state: 'csrf-state-token',
    });

    await connectMicrosoft();

    expect(mockSet).toHaveBeenCalledWith('oauth_state', 'csrf-state-token', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/api/oauth/callback',
    });
  });
});
