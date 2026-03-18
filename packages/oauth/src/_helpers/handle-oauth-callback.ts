import type { PrismaClient } from '@harness/database';
import { getMicrosoftConfig } from '../providers/microsoft';
import { encryptToken } from './encrypt-token';

type HandleOAuthCallbackInput = {
  code: string;
  provider: string;
  db: PrismaClient;
};

type HandleOAuthCallback = (input: HandleOAuthCallbackInput) => Promise<{ accountId: string; email?: string }>;

const handleOAuthCallback: HandleOAuthCallback = async ({ code, provider, db }) => {
  if (provider !== 'microsoft') {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const config = getMicrosoftConfig();

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      scope: config.scopes.join(' '),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorBody}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Fetch user profile to get accountId
  const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!profileResponse.ok) {
    throw new Error(`Failed to fetch user profile: ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };

  const accountId = profile.id;
  const email = profile.mail ?? profile.userPrincipalName;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const scopes = tokenData.scope.split(' ');

  await db.oAuthToken.upsert({
    where: { provider_accountId: { provider, accountId } },
    create: {
      provider,
      accountId,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      scopes,
      metadata: { email, displayName: profile.displayName },
    },
    update: {
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      scopes,
      metadata: { email, displayName: profile.displayName },
    },
  });

  return { accountId, email: email ?? undefined };
};

export { handleOAuthCallback };
