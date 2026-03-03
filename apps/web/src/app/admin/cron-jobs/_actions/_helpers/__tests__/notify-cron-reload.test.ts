import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOrchestratorUrl = vi.fn().mockReturnValue('http://localhost:4001');
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => mockGetOrchestratorUrl(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { notifyCronReload } = await import('../notify-cron-reload');

describe('notifyCronReload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrchestratorUrl.mockReturnValue('http://localhost:4001');
  });

  it('calls fetch with the correct URL and POST method', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await notifyCronReload();

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4001/api/plugins/cron/reload', {
      method: 'POST',
    });
  });

  it('uses the orchestrator URL from getOrchestratorUrl', async () => {
    mockGetOrchestratorUrl.mockReturnValue('http://custom-host:9000');
    mockFetch.mockResolvedValue({ ok: true });

    await notifyCronReload();

    expect(mockFetch).toHaveBeenCalledWith('http://custom-host:9000/api/plugins/cron/reload', {
      method: 'POST',
    });
  });

  it('swallows fetch errors and does not throw when orchestrator is down', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(notifyCronReload()).resolves.toBeUndefined();
  });

  it('swallows non-Error rejections gracefully', async () => {
    mockFetch.mockRejectedValue('some string error');

    await expect(notifyCronReload()).resolves.toBeUndefined();
  });

  it('resolves without a return value on success', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await notifyCronReload();

    expect(result).toBeUndefined();
  });
});
