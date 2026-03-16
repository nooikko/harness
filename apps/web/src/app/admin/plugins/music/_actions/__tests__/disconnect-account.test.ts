import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidatePath = vi.fn();
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => 'http://test-orchestrator:4000',
}));

const { disconnectAccount } = await import('../disconnect-account');

describe('disconnectAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success and revalidates on ok response', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await disconnectAccount();

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith('http://test-orchestrator:4000/api/plugins/music/oauth/disconnect', { method: 'POST' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins/music');
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Spotify error' }),
    });

    const result = await disconnectAccount();

    expect(result).toEqual({ success: false, error: 'Spotify error' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns fallback error when response body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    });

    const result = await disconnectAccount();

    expect(result).toEqual({ success: false, error: 'Request failed (502)' });
  });

  it('returns unreachable error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await disconnectAccount();

    expect(result).toEqual({
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    });
  });
});
