// Fetches a Proof-of-Origin token from a bgutil-ytdlp-pot-provider sidecar.
// PO tokens are required by YouTube for stream URL resolution since March 2025.
// The sidecar caches tokens with a configurable TTL (default 6h).
// We cache locally with a 5h TTL to refresh slightly before server expiry.

const CACHE_TTL_MS = 5 * 60 * 60 * 1000; // 5 hours
const FETCH_TIMEOUT_MS = 10_000;

type CachedToken = {
  token: string;
  fetchedAt: number;
};

let cache: CachedToken | null = null;

type PoTokenResponse = {
  poToken?: string;
  token?: string;
  contentBinding?: string;
  expiresAt?: string;
};

type FetchPoToken = (serverUrl: string) => Promise<string>;

export const fetchPoToken: FetchPoToken = async (serverUrl) => {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.token;
  }

  const response = await fetch(`${serverUrl}/get_pot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`PO token server returned ${response.status}: ${text}`);
  }

  const data = (await response.json()) as PoTokenResponse;
  const token = data.poToken ?? data.token;
  if (!token) {
    throw new Error('PO token server returned empty token');
  }

  cache = { token, fetchedAt: Date.now() };
  return token;
};

export const resetPoTokenCache = (): void => {
  cache = null;
};
