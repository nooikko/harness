import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetOrchestratorUrl = vi.fn().mockReturnValue('http://localhost:4001');
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => mockGetOrchestratorUrl(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { requestAuditDelete } = await import('../request-audit-delete');

describe('requestAuditDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrchestratorUrl.mockReturnValue('http://localhost:4001');
  });

  it('fires a request to the audit-delete endpoint with the threadId', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await requestAuditDelete('thread-1');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4001/api/audit-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1' }),
    });
  });

  it('uses the URL from getOrchestratorUrl', async () => {
    mockGetOrchestratorUrl.mockReturnValue('http://custom:9000');
    mockFetch.mockResolvedValue({ ok: true });

    await requestAuditDelete('thread-abc');

    expect(mockFetch).toHaveBeenCalledWith('http://custom:9000/api/audit-delete', expect.any(Object));
  });

  it('returns ok:true on success', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await requestAuditDelete('thread-1');

    expect(result).toEqual({ ok: true });
  });

  it('returns ok:true even when fetch rejects (fire-and-forget with void)', async () => {
    // The action uses void fetch(...) — fetch rejections are discarded intentionally.
    // The try/catch only wraps synchronous errors before the void call.
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await requestAuditDelete('thread-1');

    expect(result).toEqual({ ok: true });
  });
});
