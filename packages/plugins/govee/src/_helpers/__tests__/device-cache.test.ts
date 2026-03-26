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
  {
    sku: 'H6008',
    device: '11:22:33:44',
    deviceName: 'Quinn Office 1',
    type: 'devices.types.light',
    capabilities: [{ type: 'devices.capabilities.on_off', instance: 'powerSwitch' }],
  },
  {
    sku: 'H6008',
    device: '55:66:77:88',
    deviceName: 'Quinn Office 2',
    type: 'devices.types.light',
    capabilities: [{ type: 'devices.capabilities.on_off', instance: 'powerSwitch' }],
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
      expect(cache.devices).toHaveLength(4);
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

  describe('findAllByName', () => {
    it('returns all devices matching a room name', () => {
      const devices = cache.findAllByName('office');
      expect(devices).toHaveLength(2);
      expect(devices.map((d) => d.deviceName)).toEqual(['Quinn Office 1', 'Quinn Office 2']);
    });

    it('returns a single device for a specific name like "office 2"', () => {
      const devices = cache.findAllByName('office 2');
      expect(devices).toHaveLength(1);
      expect(devices[0]?.deviceName).toBe('Quinn Office 2');
    });

    it('returns empty array for no match', () => {
      expect(cache.findAllByName('garage')).toEqual([]);
    });

    it('is case-insensitive', () => {
      const devices = cache.findAllByName('OFFICE');
      expect(devices).toHaveLength(2);
    });

    it('returns exact match when available', () => {
      const devices = cache.findAllByName('bedroom strip');
      expect(devices).toHaveLength(1);
      expect(devices[0]?.deviceName).toBe('Bedroom Strip');
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
