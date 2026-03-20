import type { PluginContext, PluginRouteRequest } from '@harness/plugin-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOAuthRoutes } from '../oauth-routes';

// Mock the auth module
vi.mock('../youtube-music-auth', () => ({
  startDeviceCodeFlow: vi.fn(),
  pollDeviceCodeFlow: vi.fn(),
  getAccountInfo: vi.fn(),
  resetFlowState: vi.fn(),
}));

import { getAccountInfo, pollDeviceCodeFlow, resetFlowState, startDeviceCodeFlow } from '../youtube-music-auth';

const mockStartDeviceCodeFlow = startDeviceCodeFlow as ReturnType<typeof vi.fn>;
const mockPollDeviceCodeFlow = pollDeviceCodeFlow as ReturnType<typeof vi.fn>;
const mockGetAccountInfo = getAccountInfo as ReturnType<typeof vi.fn>;
const mockResetFlowState = resetFlowState as ReturnType<typeof vi.fn>;

describe('oauth-routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockCtx = () => {
    const pluginConfig = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    return {
      db: {
        pluginConfig,
        $transaction: vi.fn((cb: (tx: { pluginConfig: typeof pluginConfig }) => Promise<unknown>) => cb({ pluginConfig })),
      },
      notifySettingsChange: vi.fn().mockResolvedValue(undefined),
      reportStatus: vi.fn(),
      uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as unknown as PluginContext;
  };

  const emptyReq: PluginRouteRequest = { params: {}, query: {} };

  describe('POST /oauth/initiate', () => {
    it('returns 503 when client is not initialized', async () => {
      const routes = createOAuthRoutes({ getClient: () => null });
      const route = routes.find((r) => r.path === '/oauth/initiate' && r.method === 'POST')!;
      const ctx = createMockCtx();

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(503);
      expect((res.body as Record<string, unknown>).error).toContain('not initialized');
    });

    it('returns device code data on success', async () => {
      const mockClient = {};
      const routes = createOAuthRoutes({ getClient: () => mockClient });
      const route = routes.find((r) => r.path === '/oauth/initiate' && r.method === 'POST')!;
      const ctx = createMockCtx();

      mockStartDeviceCodeFlow.mockResolvedValue({
        userCode: 'ABCD-EFGH',
        verificationUrl: 'https://google.com/device',
        interval: 5,
        expiresIn: 300,
      });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.userCode).toBe('ABCD-EFGH');
      expect(body.verificationUrl).toBe('https://google.com/device');
    });

    it('returns 500 when startDeviceCodeFlow throws', async () => {
      const mockClient = {};
      const routes = createOAuthRoutes({ getClient: () => mockClient });
      const route = routes.find((r) => r.path === '/oauth/initiate' && r.method === 'POST')!;
      const ctx = createMockCtx();

      mockStartDeviceCodeFlow.mockRejectedValue(new Error('Flow failed'));

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(500);
      expect((res.body as Record<string, unknown>).error).toBe('Flow failed');
    });

    it('returns generic error message when non-Error is thrown', async () => {
      const mockClient = {};
      const routes = createOAuthRoutes({ getClient: () => mockClient });
      const route = routes.find((r) => r.path === '/oauth/initiate' && r.method === 'POST')!;
      const ctx = createMockCtx();

      mockStartDeviceCodeFlow.mockRejectedValue('string error');

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(500);
      expect((res.body as Record<string, unknown>).error).toBe('Failed to start OAuth flow');
    });
  });

  describe('GET /oauth/status', () => {
    it('returns pending when flow is not complete', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockPollDeviceCodeFlow.mockReturnValue({ status: 'pending' });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).status).toBe('pending');
    });

    it('returns completed with account info and saves credentials', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockPollDeviceCodeFlow.mockReturnValue({
        status: 'completed',
        credentials: {
          access_token: 'token-123',
          refresh_token: 'refresh-456',
          expiry_date: '2026-12-31T00:00:00Z',
        },
      });

      mockGetAccountInfo.mockResolvedValue({
        email: 'user@example.com',
        name: 'User',
        photo: 'https://photo.jpg',
      });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('completed');
      expect((body.account as Record<string, unknown>).email).toBe('user@example.com');

      // Verify credentials were saved
      expect(ctx.db.pluginConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pluginName: 'music' },
        }),
      );

      // Verify settings change notification
      expect(ctx.notifySettingsChange).toHaveBeenCalledWith('music');
    });

    it('saves credentials without account info when client is null', async () => {
      const routes = createOAuthRoutes({ getClient: () => null });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockPollDeviceCodeFlow.mockReturnValue({
        status: 'completed',
        credentials: {
          access_token: 'token-abc',
          refresh_token: 'refresh-xyz',
          expiry_date: '2026-12-31T00:00:00Z',
        },
      });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('completed');
      // Account info should be undefined since client was null
      const account = body.account as Record<string, unknown>;
      expect(account.email).toBeUndefined();
      expect(account.name).toBeUndefined();
      // getAccountInfo should not have been called
      expect(mockGetAccountInfo).not.toHaveBeenCalled();
    });

    it('saves credentials without account info when getAccountInfo returns null', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockPollDeviceCodeFlow.mockReturnValue({
        status: 'completed',
        credentials: {
          access_token: 'token-abc',
          refresh_token: 'refresh-xyz',
          expiry_date: '2026-12-31T00:00:00Z',
        },
      });

      mockGetAccountInfo.mockResolvedValue(null);

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('completed');
      const account = body.account as Record<string, unknown>;
      expect(account.email).toBeUndefined();
    });

    it('merges credentials with existing plugin settings', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      // Existing settings in DB
      (ctx.db.pluginConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        settings: { defaultVolume: 80, someOtherSetting: true },
      });

      mockPollDeviceCodeFlow.mockReturnValue({
        status: 'completed',
        credentials: {
          access_token: 'token-merge',
          refresh_token: 'refresh-merge',
          expiry_date: '2026-12-31T00:00:00Z',
        },
      });

      mockGetAccountInfo.mockResolvedValue(null);

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      // Verify existing settings are preserved alongside youtubeAuth
      const upsertCall = (ctx.db.pluginConfig.upsert as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const createSettings = upsertCall.create.settings as Record<string, unknown>;
      expect(createSettings.defaultVolume).toBe(80);
      expect(createSettings.someOtherSetting).toBe(true);
      expect(createSettings.youtubeAuth).toBeDefined();
    });

    it('returns error status when flow has error', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/status' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockPollDeviceCodeFlow.mockReturnValue({
        status: 'error',
        error: 'Auth denied',
      });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe('error');
      expect(body.error).toBe('Auth denied');
    });
  });

  describe('POST /oauth/disconnect', () => {
    it('clears oauth credentials and notifies settings change', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/disconnect' && r.method === 'POST')!;
      const ctx = createMockCtx();

      (ctx.db.pluginConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        settings: {
          youtubeAuth: { authMethod: 'oauth', accessToken: 'x' },
          defaultVolume: 75,
        },
      });

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).success).toBe(true);

      // Verify youtubeAuth was removed but other settings preserved
      expect(ctx.db.pluginConfig.update).toHaveBeenCalledWith({
        where: { pluginName: 'music' },
        data: { settings: { defaultVolume: 75 } },
      });

      expect(mockResetFlowState).toHaveBeenCalled();
      expect(ctx.notifySettingsChange).toHaveBeenCalledWith('music');
    });

    it('handles disconnect when no existing settings in DB', async () => {
      const routes = createOAuthRoutes({ getClient: () => ({}) });
      const route = routes.find((r) => r.path === '/oauth/disconnect' && r.method === 'POST')!;
      const ctx = createMockCtx();

      // findUnique returns null — no existing config
      (ctx.db.pluginConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).success).toBe(true);
      // Early return — no $transaction or update called
      expect(ctx.db.pluginConfig.update).not.toHaveBeenCalled();
      expect(mockResetFlowState).not.toHaveBeenCalled();
    });
  });
});
