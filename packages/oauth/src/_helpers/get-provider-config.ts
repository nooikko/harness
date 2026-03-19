import { getGoogleConfig } from '../providers/google';
import { getMicrosoftConfig } from '../providers/microsoft';

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
};

type GetProviderConfig = (provider: string) => ProviderConfig;

const getProviderConfig: GetProviderConfig = (provider) => {
  switch (provider) {
    case 'microsoft':
      return getMicrosoftConfig();
    case 'google':
      return getGoogleConfig();
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
};

export { getProviderConfig };
export type { ProviderConfig };
