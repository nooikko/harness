import { loadEnv } from '../env';

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
};

type GetGoogleConfig = () => GoogleOAuthConfig;

const getGoogleConfig: GetGoogleConfig = () => {
  const env = loadEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/oauth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar.events'],
  };
};

export type { GoogleOAuthConfig };
export { getGoogleConfig };
