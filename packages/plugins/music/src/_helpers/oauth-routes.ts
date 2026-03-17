import type { OAuthStoredCredentials, PluginContext, PluginRoute } from '@harness/plugin-contract';
import { getAccountInfo, pollDeviceCodeFlow, resetFlowState, startDeviceCodeFlow } from './youtube-music-auth';

// --- Types ---

type InnertubeClientRef = {
  getClient: () => unknown | null;
};

// --- Route factory ---

type CreateOAuthRoutes = (clientRef: InnertubeClientRef) => PluginRoute[];

export const createOAuthRoutes: CreateOAuthRoutes = (clientRef) => [
  {
    method: 'POST',
    path: '/oauth/initiate',
    handler: async (_ctx: PluginContext, _req) => {
      const innertube = clientRef.getClient();
      if (!innertube) {
        return { status: 503, body: { error: 'YouTube Music client not initialized' } };
      }

      try {
        const result = await startDeviceCodeFlow(innertube as Parameters<typeof startDeviceCodeFlow>[0]);
        return {
          status: 200,
          body: {
            userCode: result.userCode,
            verificationUrl: result.verificationUrl,
            expiresIn: result.expiresIn,
          },
        };
      } catch (err) {
        return {
          status: 500,
          body: { error: err instanceof Error ? err.message : 'Failed to start OAuth flow' },
        };
      }
    },
  },

  {
    method: 'GET',
    path: '/oauth/status',
    handler: async (ctx: PluginContext, _req) => {
      const result = pollDeviceCodeFlow();

      if (result.status === 'completed' && result.credentials) {
        // Save credentials to PluginConfig.settings
        const creds = result.credentials;
        const oauthStored: OAuthStoredCredentials = {
          authMethod: 'oauth',
          accessToken: creds.access_token,
          refreshToken: creds.refresh_token,
          expiresAt: creds.expiry_date,
        };

        // Fetch account info if possible
        const innertube = clientRef.getClient();
        if (innertube) {
          const accountInfo = await getAccountInfo(innertube as Parameters<typeof getAccountInfo>[0], ctx.logger);
          if (accountInfo) {
            oauthStored.accountEmail = accountInfo.email;
            oauthStored.accountName = accountInfo.name;
            oauthStored.accountPhoto = accountInfo.photo;
          }
        }

        // Persist to DB
        const existing = await ctx.db.pluginConfig.findUnique({
          where: { pluginName: 'music' },
        });
        const currentSettings = (existing?.settings ?? {}) as Record<string, unknown>;
        await ctx.db.pluginConfig.upsert({
          where: { pluginName: 'music' },
          create: {
            pluginName: 'music',
            enabled: true,
            settings: { ...currentSettings, youtubeAuth: oauthStored } as Record<string, unknown> as never,
          },
          update: {
            settings: { ...currentSettings, youtubeAuth: oauthStored } as Record<string, unknown> as never,
          },
        });

        // Notify settings change so plugin reinitializes
        await ctx.notifySettingsChange('music');

        return {
          status: 200,
          body: {
            status: 'completed',
            account: {
              email: oauthStored.accountEmail,
              name: oauthStored.accountName,
              photo: oauthStored.accountPhoto,
            },
          },
        };
      }

      if (result.status === 'error') {
        return {
          status: 200,
          body: { status: 'error', error: result.error },
        };
      }

      return { status: 200, body: { status: 'pending' } };
    },
  },

  {
    method: 'POST',
    path: '/oauth/disconnect',
    handler: async (ctx: PluginContext, _req) => {
      // Clear OAuth credentials from settings
      const existing = await ctx.db.pluginConfig.findUnique({
        where: { pluginName: 'music' },
      });
      const currentSettings = (existing?.settings ?? {}) as Record<string, unknown>;
      const { youtubeAuth: _removed, ...rest } = currentSettings;

      await ctx.db.pluginConfig.update({
        where: { pluginName: 'music' },
        data: { settings: rest as never },
      });

      // Reset any pending flow state
      resetFlowState();

      // Notify settings change so plugin reinitializes without auth
      await ctx.notifySettingsChange('music');

      return { status: 200, body: { success: true } };
    },
  },
];
