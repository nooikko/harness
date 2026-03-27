import type { PluginContext, PluginRouteRequest } from '@harness/plugin-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeviceRoutes } from '../device-routes';

// Mock dependencies
vi.mock('../cast-device-manager', () => ({
  listDevices: vi.fn(),
  resolveDeviceById: vi.fn(),
  getDeviceStatuses: vi.fn(),
}));

vi.mock('../device-alias-manager', () => ({
  getDeviceAliases: vi.fn(),
  setDeviceAlias: vi.fn(),
}));

import { getDeviceStatuses, listDevices, resolveDeviceById } from '../cast-device-manager';
import { getDeviceAliases, setDeviceAlias } from '../device-alias-manager';

const mockListDevices = listDevices as ReturnType<typeof vi.fn>;
const mockResolveDeviceById = resolveDeviceById as ReturnType<typeof vi.fn>;
const mockGetDeviceStatuses = getDeviceStatuses as ReturnType<typeof vi.fn>;
const mockGetDeviceAliases = getDeviceAliases as ReturnType<typeof vi.fn>;
const mockSetDeviceAlias = setDeviceAlias as ReturnType<typeof vi.fn>;

describe('device-routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockCtx = () =>
    ({
      db: {
        pluginConfig: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
      notifySettingsChange: vi.fn().mockResolvedValue(undefined),
      reportStatus: vi.fn(),
      reportBackgroundError: vi.fn(),
      runBackground: vi.fn(),
      uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }) as unknown as PluginContext;

  const emptyReq: PluginRouteRequest = { params: {}, query: {} };

  const mockIdentifyDevice = vi.fn();
  const routes = createDeviceRoutes({ identifyDevice: mockIdentifyDevice });

  describe('GET /devices', () => {
    it('returns device list with aliases and statuses', async () => {
      const route = routes.find((r) => r.path === '/devices' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockListDevices.mockReturnValue([
        { id: 'dev-1', name: 'Speaker One', model: 'Google Home', host: '192.168.1.1', port: 8009 },
        { id: 'dev-2', name: 'Speaker Two', model: undefined, host: '192.168.1.2', port: 8009 },
      ]);

      mockGetDeviceAliases.mockReturnValue({ 'dev-1': 'Kitchen' });
      mockGetDeviceStatuses.mockReturnValue(
        new Map([
          ['dev-1', 'playing'],
          ['dev-2', 'available'],
        ]),
      );

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as { devices: Array<Record<string, unknown>> };
      expect(body.devices).toHaveLength(2);
      expect(body.devices[0]).toEqual({
        id: 'dev-1',
        name: 'Speaker One',
        alias: 'Kitchen',
        model: 'Google Home',
        host: '192.168.1.1',
        port: 8009,
        status: 'playing',
      });
      expect(body.devices[1]?.alias).toBeNull();
      expect(body.devices[1]?.model).toBeNull();
    });

    it('returns empty device list', async () => {
      const route = routes.find((r) => r.path === '/devices' && r.method === 'GET')!;
      const ctx = createMockCtx();

      mockListDevices.mockReturnValue([]);
      mockGetDeviceAliases.mockReturnValue({});
      mockGetDeviceStatuses.mockReturnValue(new Map());

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(200);
      const body = res.body as { devices: unknown[] };
      expect(body.devices).toHaveLength(0);
    });
  });

  describe('POST /devices/alias', () => {
    it('sets device alias and notifies settings change', async () => {
      const route = routes.find((r) => r.path === '/devices/alias' && r.method === 'POST')!;
      const ctx = createMockCtx();
      mockSetDeviceAlias.mockResolvedValue(undefined);

      const req: PluginRouteRequest = {
        body: { deviceId: 'dev-1', alias: 'Kitchen' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).success).toBe(true);
      expect(mockSetDeviceAlias).toHaveBeenCalledWith(ctx, 'dev-1', 'Kitchen');
      expect(ctx.notifySettingsChange).toHaveBeenCalledWith('music');
    });

    it('returns 400 when deviceId is missing', async () => {
      const route = routes.find((r) => r.path === '/devices/alias' && r.method === 'POST')!;
      const ctx = createMockCtx();

      const req: PluginRouteRequest = {
        body: { alias: 'Kitchen' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when alias is missing', async () => {
      const route = routes.find((r) => r.path === '/devices/alias' && r.method === 'POST')!;
      const ctx = createMockCtx();

      const req: PluginRouteRequest = {
        body: { deviceId: 'dev-1' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /identify-device', () => {
    it('returns 400 when deviceId is missing', async () => {
      const route = routes.find((r) => r.path === '/identify-device' && r.method === 'POST')!;
      const ctx = createMockCtx();

      const res = await route.handler(ctx, emptyReq);

      expect(res.status).toBe(400);
    });

    it('returns 404 when device not found', async () => {
      const route = routes.find((r) => r.path === '/identify-device' && r.method === 'POST')!;
      const ctx = createMockCtx();
      mockResolveDeviceById.mockReturnValue(null);

      const req: PluginRouteRequest = {
        body: { deviceId: 'nonexistent' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(404);
    });

    it('calls identifyDevice and returns success', async () => {
      const route = routes.find((r) => r.path === '/identify-device' && r.method === 'POST')!;
      const ctx = createMockCtx();
      mockResolveDeviceById.mockReturnValue({ id: 'dev-1', name: 'Speaker' });
      mockIdentifyDevice.mockResolvedValue('Played chime on Speaker');

      const req: PluginRouteRequest = {
        body: { deviceId: 'dev-1' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(200);
      expect((res.body as Record<string, unknown>).success).toBe(true);
      expect(mockIdentifyDevice).toHaveBeenCalledWith('dev-1');
    });

    it('returns 500 when identifyDevice throws', async () => {
      const route = routes.find((r) => r.path === '/identify-device' && r.method === 'POST')!;
      const ctx = createMockCtx();
      mockResolveDeviceById.mockReturnValue({ id: 'dev-1', name: 'Speaker' });
      mockIdentifyDevice.mockRejectedValue(new Error('Connection failed'));

      const req: PluginRouteRequest = {
        body: { deviceId: 'dev-1' },
        params: {},
        query: {},
      };

      const res = await route.handler(ctx, req);

      expect(res.status).toBe(500);
      expect((res.body as Record<string, unknown>).error).toBe('Connection failed');
    });
  });
});
