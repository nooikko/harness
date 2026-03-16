import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => 'http://test-orchestrator:4000',
}));

const { initiateOAuth } = await import('../initiate-oauth');

describe('initiateOAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with oauth data on ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          userCode: 'ABC-123',
          verificationUrl: 'https://spotify.com/pair',
          expiresIn: 300,
        }),
    });

    const result = await initiateOAuth();

    expect(result).toEqual({
      success: true,
      userCode: 'ABC-123',
      verificationUrl: 'https://spotify.com/pair',
      expiresIn: 300,
    });
    expect(mockFetch).toHaveBeenCalledWith('http://test-orchestrator:4000/api/plugins/music/oauth/initiate', { method: 'POST' });
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Client ID missing' }),
    });

    const result = await initiateOAuth();

    expect(result).toEqual({ success: false, error: 'Client ID missing' });
  });

  it('returns fallback error when response body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await initiateOAuth();

    expect(result).toEqual({ success: false, error: 'Request failed (500)' });
  });

  it('returns unreachable error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await initiateOAuth();

    expect(result).toEqual({
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    });
  });
});
