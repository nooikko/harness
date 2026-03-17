import { randomBytes } from 'node:crypto';
import { getMicrosoftConfig } from '../providers/microsoft';

type OAuthFlowResult = {
  authUrl: string;
  state: string;
};

type StartOAuthFlow = (provider: string) => OAuthFlowResult;

const startOAuthFlow: StartOAuthFlow = (provider) => {
  if (provider !== 'microsoft') {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const config = getMicrosoftConfig();
  const state = randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_mode: 'query',
    prompt: 'consent',
  });

  return {
    authUrl: `${config.authorizeEndpoint}?${params.toString()}`,
    state,
  };
};

export { startOAuthFlow };
