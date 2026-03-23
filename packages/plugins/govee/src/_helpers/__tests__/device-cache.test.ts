import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceCache, type DeviceCache } from '../device-cache';
import type { GoveeClient } from '../govee-client';
import type { GoveeDevice } from '../govee-types';

const mockDevices: GoveeDevice[] = [
  {
    sku: 'H6008',
    device: 'AA:BB:CC:DD',
    deviceName: 'Living Room Light',
    type: 'devices.types.light',
    capabilities: [
      { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
      { type: 'devices.capabilities.range', instance: 'brightness' },
    ],
  },
  {
    sku: 'H6159',
    device: 'EE:FF:00:11',
    deviceName: 'Bedroom Strip',
    type: 'devices.types.light',
    capabilities: [
      { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
      { type: 'devices.capabilities.color_setting', instance: 'colorRgb' },
    ],
  },
];

const makeClient = (): GoveeClient => ({
  listDevices: vi.fn().mockResolvedValue(mockDevices),
  getDeviceState: vi.fn().mockResolvedValue({ sku: '', device: '', capabilities: [] }),
  controlDevice: vi.fn().mockResolvedValue(undefined),
});

describe('DeviceCache', () => {
  let client: GoveeClient;
  let cache: DeviceCache;

  beforeEach(async () => {
    client = makeClient();
    cache = createDeviceCache(client);
    await cache.refresh();
  });

  describe('refresh', () => {
    it('fetches devices from client', () => {
      expect(client.listDevices).toHaveBeenCalled();
    });
  });

  describe('devices', () => {
    it('returns all cached devices', () => {
      expect(cache.devices).toHaveLength(2);
    });
  });

  describe('findByName', () => {
    it('finds device by exact name (case-insensitive)', () => {
      const device = cache.findByName('living room light');
      expect(device?.device).toBe('AA:BB:CC:DD');
    });

    it('finds device by substring', () => {
      const device = cache.findByName('bedroom');
      expect(device?.device).toBe('EE:FF:00:11');
    });

    it('returns undefined for no match', () => {
      expect(cache.findByName('kitchen')).toBeUndefined();
    });
  });

  describe('findByMac', () => {
    it('finds device by MAC address', () => {
      const device = cache.findByMac('AA:BB:CC:DD');
      expect(device?.deviceName).toBe('Living Room Light');
    });

    it('is case-insensitive for MAC', () => {
      const device = cache.findByMac('aa:bb:cc:dd');
      expect(device?.deviceName).toBe('Living Room Light');
    });

    it('returns undefined for unknown MAC', () => {
      expect(cache.findByMac('ZZ:ZZ')).toBeUndefined();
    });
  });

  describe('hasCapability', () => {
    it('returns true when device has the capability', () => {
      const device = mockDevices[1]!;
      expect(cache.hasCapability(device, 'colorRgb')).toBe(true);
    });

    it('returns false when device lacks the capability', () => {
      const device = mockDevices[0]!;
      expect(cache.hasCapability(device, 'colorRgb')).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears cached devices', () => {
      cache.clear();
      expect(cache.devices).toEqual([]);
    });
  });
});
