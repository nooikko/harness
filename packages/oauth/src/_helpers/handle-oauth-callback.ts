import type { PrismaClient } from '@harness/database';
import { encryptToken } from './encrypt-token';
import { getProviderConfig } from './get-provider-config';

type HandleOAuthCallbackInput = {
  code: string;
  provider: string;
  db: PrismaClient;
};

type ProfileResult = {
  accountId: string;
  email?: string;
  displayName?: string;
};

type FetchProfile = (accessToken: string, provider: string) => Promise<ProfileResult>;

const fetchProfile: FetchProfile = async (accessToken, provider) => {
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user profile: ${response.status}`);
    }

    const profile = (await response.json()) as {
      id: string;
      email?: string;
      name?: string;
    };

    return {
      accountId: profile.id,
      email: profile.email,
      displayName: profile.name,
    };
  }

  // Microsoft (default)
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.status}`);
  }

  const profile = (await response.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };

  return {
    accountId: profile.id,
    email: profile.mail ?? profile.userPrincipalName,
    displayName: profile.displayName,
  };
};

type HandleOAuthCallback = (input: HandleOAuthCallbackInput) => Promise<{ accountId: string; email?: string }>;

const handleOAuthCallback: HandleOAuthCallback = async ({ code, provider, db }) => {
  const config = getProviderConfig(provider);

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

  const profile = await fetchProfile(tokenData.access_token, provider);
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const scopes = tokenData.scope.split(' ');

  await db.oAuthToken.upsert({
    where: {
      provider_accountId: { provider, accountId: profile.accountId },
    },
    create: {
      provider,
      accountId: profile.accountId,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      scopes,
      metadata: { email: profile.email, displayName: profile.displayName },
    },
    update: {
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      scopes,
      metadata: { email: profile.email, displayName: profile.displayName },
    },
  });

  return { accountId: profile.accountId, email: profile.email ?? undefined };
};

export { handleOAuthCallback };
