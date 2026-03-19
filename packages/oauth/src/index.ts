export { validateEncryptionKeyIfSet } from './_helpers/get-encryption-key';
export { getProviderConfig } from './_helpers/get-provider-config';
export { getValidToken } from './_helpers/get-valid-token';
export { handleOAuthCallback } from './_helpers/handle-oauth-callback';
export { revokeToken } from './_helpers/revoke-token';
export { startOAuthFlow } from './_helpers/start-oauth-flow';
export { getGoogleConfig } from './providers/google';
export { getMicrosoftConfig } from './providers/microsoft';

type SupportedProvider = 'microsoft' | 'google';

const SUPPORTED_PROVIDERS: SupportedProvider[] = ['microsoft', 'google'];

type IsProviderSupported = (provider: string) => provider is SupportedProvider;

const isProviderSupported: IsProviderSupported = (provider): provider is SupportedProvider =>
  SUPPORTED_PROVIDERS.includes(provider as SupportedProvider);

export { isProviderSupported };
export type { SupportedProvider };
