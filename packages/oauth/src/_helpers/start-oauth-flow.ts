import { randomBytes } from 'node:crypto';
import { getProviderConfig } from './get-provider-config';

type OAuthFlowResult = {
  authUrl: string;
  state: string;
};

type StartOAuthFlow = (provider: string) => OAuthFlowResult;

const startOAuthFlow: StartOAuthFlow = (provider) => {
  const config = getProviderConfig(provider);
  const state = randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    prompt: 'consent',
  });

  // Provider-specific params
  if (provider === 'google') {
    params.set('access_type', 'offline');
  } else if (provider === 'microsoft') {
    params.set('response_mode', 'query');
  }

  return {
    authUrl: `${config.authorizeEndpoint}?${params.toString()}`,
    state,
  };
};

export { startOAuthFlow };
