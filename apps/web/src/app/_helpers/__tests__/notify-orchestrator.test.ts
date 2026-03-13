import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => 'http://localhost:4001',
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

describe('notifyOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts event and data to /api/broadcast', async () => {
    const { notifyOrchestrator } = await import('../notify-orchestrator');

    await notifyOrchestrator('file:uploaded', { fileId: '123' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4001/api/broadcast',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'file:uploaded',
          data: { fileId: '123' },
        }),
      }),
    );
  });

  it('does not throw when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('unreachable'));

    const { notifyOrchestrator } = await import('../notify-orchestrator');

    await expect(notifyOrchestrator('file:uploaded', {})).resolves.toBeUndefined();
  });

  it('does not throw when fetch returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { notifyOrchestrator } = await import('../notify-orchestrator');

    await expect(notifyOrchestrator('file:deleted', { fileId: '456' })).resolves.toBeUndefined();
  });
});
