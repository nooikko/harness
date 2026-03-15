import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchVector } from '../search-vector';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('searchVector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns hits from the orchestrator', async () => {
    const hits = [
      { id: 'm1', score: 0.9, collection: 'messages' },
      { id: 't1', score: 0.8, collection: 'threads' },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits }),
    });

    const result = await searchVector('test query');
    expect(result).toEqual(hits);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/vector'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('sends default collections and limit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await searchVector('test');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.collections).toEqual(['messages', 'threads']);
    expect(body.limit).toBe(5);
  });

  it('passes custom collections and limit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hits: [] }),
    });

    await searchVector('test', { collections: ['files'], limit: 10 });
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.collections).toEqual(['files']);
    expect(body.limit).toBe(10);
  });

  it('returns empty array on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const result = await searchVector('test');
    expect(result).toEqual([]);
  });

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await searchVector('test');
    expect(result).toEqual([]);
  });
});
