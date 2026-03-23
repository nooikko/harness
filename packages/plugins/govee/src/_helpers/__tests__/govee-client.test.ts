import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoveeClient, type GoveeClient } from '../govee-client';
import type { GoveeDevice, GoveeDeviceListResponse } from '../govee-types';
import { createRateLimiter, type RateLimiter } from '../rate-limiter';

const mockDevice: GoveeDevice = {
  sku: 'H6008',
  device: 'AA:BB:CC:DD:EE:FF:GG:HH',
  deviceName: 'Living Room Light',
  type: 'devices.types.light',
  capabilities: [
    { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
    {
      type: 'devices.capabilities.range',
      instance: 'brightness',
      parameters: { dataType: 'INTEGER', range: { min: 1, max: 100, precision: 1 } },
    },
  ],
};

const makeListResponse = (devices: GoveeDevice[]): GoveeDeviceListResponse => ({
  code: 200,
  message: 'success',
  data: devices,
});

describe('createGoveeClient', () => {
  let client: GoveeClient;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    limiter = createRateLimiter({ perDevicePerMinute: 10, dailyLimit: 10000 });
    client = createGoveeClient({ apiKey: 'test-api-key' }, limiter);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends Govee-API-Key header on all requests', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(makeListResponse([mockDevice])),
    });

    await client.listDevices();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Govee-API-Key': 'test-api-key',
        }),
      }),
    );
  });

  it('uses the correct base URL', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(makeListResponse([mockDevice])),
    });

    await client.listDevices();

    expect(fetchSpy).toHaveBeenCalledWith('https://openapi.api.govee.com/router/api/v1/user/devices', expect.any(Object));
  });

  describe('listDevices', () => {
    it('returns array of devices', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(makeListResponse([mockDevice])),
      });

      const devices = await client.listDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0]?.deviceName).toBe('Living Room Light');
    });
  });

  describe('getDeviceState', () => {
    it('sends POST with device identifiers', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: 200,
            message: 'success',
            payload: { sku: 'H6008', device: 'AA:BB', capabilities: [] },
          }),
      });

      await client.getDeviceState('H6008', 'AA:BB');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://openapi.api.govee.com/router/api/v1/device/state',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string);
      expect(body.payload).toEqual({ sku: 'H6008', device: 'AA:BB' });
      expect(body.requestId).toBeTypeOf('string');
    });
  });

  describe('controlDevice', () => {
    it('sends control command with capability', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 200, message: 'success' }),
      });

      await client.controlDevice('H6008', 'AA:BB', {
        type: 'devices.capabilities.on_off',
        instance: 'powerSwitch',
        value: 1,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://openapi.api.govee.com/router/api/v1/device/control',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('checks rate limiter before sending', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 200, message: 'success' }),
      });

      // Exhaust the rate limit
      for (let i = 0; i < 10; i++) {
        await client.controlDevice('H6008', 'AA:BB', {
          type: 'devices.capabilities.on_off',
          instance: 'powerSwitch',
          value: 1,
        });
      }

      // 11th should be rejected by rate limiter
      await expect(
        client.controlDevice('H6008', 'AA:BB', {
          type: 'devices.capabilities.on_off',
          instance: 'powerSwitch',
          value: 1,
        }),
      ).rejects.toMatchObject({
        type: 'RATE_LIMITED',
      });

      // Only 10 actual fetch calls should have been made
      expect(fetchSpy).toHaveBeenCalledTimes(10);
    });
  });

  describe('error handling', () => {
    it('throws AUTH_FAILED on 401', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ code: 401, message: 'Unauthorized' }),
      });

      await expect(client.listDevices()).rejects.toMatchObject({
        type: 'AUTH_FAILED',
      });
    });

    it('throws RATE_LIMITED on 429', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ code: 429, message: 'Too Many Requests' }),
      });

      await expect(client.listDevices()).rejects.toMatchObject({
        type: 'RATE_LIMITED',
      });
    });

    it('throws API_ERROR on other HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ code: 500, message: 'Internal Server Error' }),
      });

      await expect(client.listDevices()).rejects.toMatchObject({
        type: 'API_ERROR',
        statusCode: 500,
      });
    });
  });
});
