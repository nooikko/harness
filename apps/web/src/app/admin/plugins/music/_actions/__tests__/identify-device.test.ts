import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => 'http://test-orchestrator:4000',
}));

const { identifyDevice } = await import('../identify-device');

describe('identifyDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on ok response', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await identifyDevice('device-abc');

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith('http://test-orchestrator:4000/api/plugins/music/identify-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'device-abc' }),
    });
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Device not found' }),
    });

    const result = await identifyDevice('device-abc');

    expect(result).toEqual({ success: false, error: 'Device not found' });
  });

  it('returns fallback error when response body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const result = await identifyDevice('device-abc');

    expect(result).toEqual({ success: false, error: 'Request failed (500)' });
  });

  it('returns unreachable error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await identifyDevice('device-abc');

    expect(result).toEqual({
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    });
  });
});
