import type { OAuthStoredCredentials } from '@harness/plugin-contract';

// --- Types ---

type InnertubeClient = {
  session: {
    logged_in: boolean;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    signIn: (credentials?: unknown) => Promise<void>;
    signOut: () => Promise<void>;
    oauth: {
      cacheCredentials: () => Promise<void>;
      removeCache: () => Promise<void>;
    };
  };
  account?: {
    getInfo?: () => Promise<{
      contents?: {
        sections?: Array<{
          contents?: Array<{
            account_name?: { toString?: () => string };
            account_email?: { toString?: () => string };
            account_photo?: Array<{ url?: string }>;
          }>;
        }>;
      };
    }>;
  };
};

export type DeviceCodeFlowResult = {
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresIn: number;
};

export type AuthCredentials = {
  access_token: string;
  refresh_token: string;
  expiry_date: string;
  [key: string]: unknown;
};

// --- State for active device-code flow ---

let pendingCredentials: AuthCredentials | null = null;
let flowError: string | null = null;
let flowCompleted = false;

// --- Auth helpers ---

export const initWithCredentials = async (innertube: InnertubeClient, credentials: OAuthStoredCredentials): Promise<void> => {
  if (credentials.authMethod === 'cookie') {
    // Cookie auth is handled at Innertube.create() time via the cookie option.
    // This function is for OAuth credentials only.
    return;
  }

  if (!credentials.accessToken || !credentials.refreshToken) {
    return;
  }

  const oauthCreds = {
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expiry_date: credentials.expiresAt ?? new Date().toISOString(),
    ...(credentials.providerMeta ?? {}),
  };

  // Listen for token refresh events to capture updated credentials
  innertube.session.on('update-credentials', (({ credentials: updated }: { credentials: AuthCredentials }) => {
    pendingCredentials = updated;
  }) as (...args: unknown[]) => void);

  await innertube.session.signIn(oauthCreds);
};

export const startDeviceCodeFlow = async (innertube: InnertubeClient): Promise<DeviceCodeFlowResult> => {
  // Reset flow state
  pendingCredentials = null;
  flowError = null;
  flowCompleted = false;

  return new Promise<DeviceCodeFlowResult>((resolve, reject) => {
    let resolved = false;

    innertube.session.on('auth-pending', ((data: { verification_url: string; user_code: string; interval?: number; expires_in?: number }) => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve({
        userCode: data.user_code,
        verificationUrl: data.verification_url,
        interval: data.interval ?? 5,
        expiresIn: data.expires_in ?? 300,
      });
    }) as (...args: unknown[]) => void);

    innertube.session.on('auth', (({ credentials }: { credentials: AuthCredentials }) => {
      pendingCredentials = credentials;
      flowCompleted = true;
    }) as (...args: unknown[]) => void);

    innertube.session.on('auth-error', (error: unknown) => {
      flowError = error instanceof Error ? error.message : String(error ?? 'Unknown auth error');
      flowCompleted = true;
    });

    // Trigger the sign-in flow — this will emit auth-pending
    void innertube.session.signIn().catch((err: unknown) => {
      if (!resolved) {
        reject(err instanceof Error ? err : new Error(String(err)));
      } else {
        flowError = err instanceof Error ? err.message : String(err);
        flowCompleted = true;
      }
    });
  });
};

export const pollDeviceCodeFlow = (): {
  status: 'pending' | 'completed' | 'error';
  credentials?: AuthCredentials;
  error?: string;
} => {
  if (flowError) {
    const error = flowError;
    flowError = null;
    return { status: 'error', error };
  }

  if (flowCompleted && pendingCredentials) {
    const credentials = pendingCredentials;
    pendingCredentials = null;
    flowCompleted = false;
    return { status: 'completed', credentials };
  }

  return { status: 'pending' };
};

export const getAccountInfo = async (
  innertube: InnertubeClient,
): Promise<{
  email?: string;
  name?: string;
  photo?: string;
} | null> => {
  try {
    if (!innertube.session.logged_in) {
      return null;
    }

    if (!innertube.account?.getInfo) {
      return null;
    }

    const info = await innertube.account.getInfo();
    const section = info?.contents?.sections?.[0];
    const account = section?.contents?.[0];

    if (!account) {
      return null;
    }

    return {
      email: account.account_email?.toString?.(),
      name: account.account_name?.toString?.(),
      photo: account.account_photo?.[0]?.url,
    };
  } catch {
    return null;
  }
};

export const resetFlowState = (): void => {
  pendingCredentials = null;
  flowError = null;
  flowCompleted = false;
};
