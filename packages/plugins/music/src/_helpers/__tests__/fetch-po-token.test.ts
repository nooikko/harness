import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fetchPoToken, resetPoTokenCache } from '../fetch-po-token';

describe('fetchPoToken', () => {
  beforeEach(() => {
    resetPoTokenCache();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('fetches a PO token from the server via POST /get_pot', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ poToken: 'po-token-abc123', contentBinding: 'cb' }),
    });

    const token = await fetchPoToken('http://localhost:4416');
    expect(token).toBe('po-token-abc123');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4416/get_pot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: expect.any(AbortSignal),
    });
  });

  it('accepts legacy token field as fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'legacy-token' }),
    });

    const token = await fetchPoToken('http://localhost:4416');
    expect(token).toBe('legacy-token');
  });

  it('returns cached token on subsequent calls within TTL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ poToken: 'po-token-cached' }),
    });

    const first = await fetchPoToken('http://localhost:4416');
    const second = await fetchPoToken('http://localhost:4416');

    expect(first).toBe('po-token-cached');
    expect(second).toBe('po-token-cached');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when server returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(fetchPoToken('http://localhost:4416')).rejects.toThrow('PO token server returned 500');
  });

  it('throws when server returns no token field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(fetchPoToken('http://localhost:4416')).rejects.toThrow('PO token server returned empty token');
  });

  it('throws when server is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(fetchPoToken('http://localhost:4416')).rejects.toThrow('ECONNREFUSED');
  });

  it('re-fetches after cache is reset', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ poToken: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ poToken: 'token-2' }),
      });

    const first = await fetchPoToken('http://localhost:4416');
    expect(first).toBe('token-1');

    resetPoTokenCache();

    const second = await fetchPoToken('http://localhost:4416');
    expect(second).toBe('token-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
