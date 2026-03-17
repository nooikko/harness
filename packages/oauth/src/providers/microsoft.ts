import { loadEnv } from '../env';

type MicrosoftOAuthConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
};

const getMicrosoftConfig = (): MicrosoftOAuthConfig => {
  const env = loadEnv();
  const clientId = env.MICROSOFT_CLIENT_ID;
  const clientSecret = env.MICROSOFT_CLIENT_SECRET;
  const tenantId = env.MICROSOFT_TENANT_ID ?? 'common';
  const redirectUri = env.MICROSOFT_REDIRECT_URI ?? 'http://localhost:3000/api/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set');
  }

  return {
    clientId,
    clientSecret,
    tenantId,
    redirectUri,
    authorizeEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    scopes: ['openid', 'profile', 'User.Read', 'offline_access', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'Calendars.Read', 'Calendars.ReadWrite'],
  };
};

export { getMicrosoftConfig };
export type { MicrosoftOAuthConfig };
