import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOrchestratorUrl = vi.fn().mockReturnValue('http://localhost:4001');
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => mockGetOrchestratorUrl(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { prewarmSession } = await import('../prewarm-session');

describe('prewarmSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts to orchestrator prewarm endpoint with threadId', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await prewarmSession('thread-1');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4001/api/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1' }),
    });
  });

  it('uses the orchestrator URL from getOrchestratorUrl', async () => {
    mockGetOrchestratorUrl.mockReturnValue('http://custom-host:9000');
    mockFetch.mockResolvedValue({ ok: true });

    await prewarmSession('thread-abc');

    expect(mockFetch).toHaveBeenCalledWith('http://custom-host:9000/api/prewarm', expect.any(Object));
  });

  it('silently ignores fetch failures', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(prewarmSession('thread-1')).resolves.toBeUndefined();
  });

  it('resolves without a return value on success', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await prewarmSession('thread-1');

    expect(result).toBeUndefined();
  });
});
