import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrewarmTrigger } from '../prewarm-trigger';

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

describe('PrewarmTrigger', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<PrewarmTrigger threadId='thread-1' />);

    expect(container.innerHTML).toBe('');
  });

  it('fires a POST /api/prewarm fetch on mount', () => {
    render(<PrewarmTrigger threadId='thread-1' />);

    expect(mockFetch).toHaveBeenCalledWith('/api/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1' }),
      signal: expect.any(AbortSignal),
    });
  });

  it('fires with the correct threadId', () => {
    render(<PrewarmTrigger threadId='thread-xyz' />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/prewarm',
      expect.objectContaining({
        body: JSON.stringify({ threadId: 'thread-xyz' }),
      }),
    );
  });

  it('aborts the fetch on unmount', () => {
    const { unmount } = render(<PrewarmTrigger threadId='thread-1' />);

    const signal = mockFetch.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('silently ignores fetch errors', () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Should not throw
    expect(() => render(<PrewarmTrigger threadId='thread-1' />)).not.toThrow();
  });
});
