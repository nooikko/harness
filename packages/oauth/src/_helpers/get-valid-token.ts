import type { PrismaClient } from '@harness/database';
import { getMicrosoftConfig } from '../providers/microsoft';
import { decryptToken } from './decrypt-token';
import { encryptToken } from './encrypt-token';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

// Simple mutex to prevent concurrent refresh races
const refreshLocks = new Map<string, Promise<string>>();

type GetValidToken = (provider: string, db: PrismaClient) => Promise<string>;

type RefreshAccessToken = (tokenId: string, encryptedRefreshToken: string | null, provider: string, db: PrismaClient) => Promise<string>;

const refreshAccessToken: RefreshAccessToken = async (tokenId, encryptedRefreshToken, provider, db) => {
  if (!encryptedRefreshToken) {
    throw new Error(`No refresh token available for ${provider}. Re-authenticate at /admin/integrations.`);
  }

  const refreshToken = decryptToken(encryptedRefreshToken);
  const config = getMicrosoftConfig();

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: config.scopes.join(' '),
    }),
  });

  if (!response.ok) {
    // Consume body to avoid connection leak, but don't expose it in errors
    await response.text();
    if (response.status === 400 || response.status === 401) {
      throw new Error(`OAuth token expired or revoked for ${provider}. Re-authenticate at /admin/integrations.`);
    }
    throw new Error(`Token refresh failed with status ${response.status}. Check server logs.`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.oAuthToken.update({
    where: { id: tokenId },
    data: {
      accessToken: encryptToken(data.access_token),
      refreshToken: data.refresh_token ? encryptToken(data.refresh_token) : undefined,
      expiresAt,
    },
  });

  return data.access_token;
};

const getValidToken: GetValidToken = async (provider, db) => {
  const token = await db.oAuthToken.findFirst({
    where: { provider },
    orderBy: { updatedAt: 'desc' },
  });

  if (!token) {
    throw new Error(`No ${provider} OAuth token found. Connect your account at /admin/integrations.`);
  }

  const now = Date.now();
  const expiresAt = token.expiresAt.getTime();

  // Token is still valid (with buffer)
  if (expiresAt - now > REFRESH_BUFFER_MS) {
    return decryptToken(token.accessToken);
  }

  // Need to refresh — use mutex to prevent race conditions
  const lockKey = `${provider}:${token.accountId}`;
  const existingRefresh = refreshLocks.get(lockKey);
  if (existingRefresh) {
    return existingRefresh;
  }

  const refreshPromise = refreshAccessToken(token.id, token.refreshToken, provider, db);
  refreshLocks.set(lockKey, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    refreshLocks.delete(lockKey);
  }
};

export { getValidToken };
