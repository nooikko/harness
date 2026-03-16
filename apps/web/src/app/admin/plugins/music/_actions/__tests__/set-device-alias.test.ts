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

const { setDeviceAlias } = await import('../set-device-alias');

describe('setDeviceAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success and revalidates on ok response', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await setDeviceAlias('device-abc', 'Living Room Speaker');

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith('http://test-orchestrator:4000/api/plugins/music/devices/alias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'device-abc',
        alias: 'Living Room Speaker',
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/plugins/music');
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Alias too long' }),
    });

    const result = await setDeviceAlias('device-abc', 'x'.repeat(200));

    expect(result).toEqual({ success: false, error: 'Alias too long' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('returns fallback error when response body has no error field', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    });

    const result = await setDeviceAlias('device-abc', 'Speaker');

    expect(result).toEqual({ success: false, error: 'Request failed (502)' });
  });

  it('returns unreachable error when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await setDeviceAlias('device-abc', 'Speaker');

    expect(result).toEqual({
      success: false,
      error: 'Could not reach orchestrator. Is it running?',
    });
  });
});
