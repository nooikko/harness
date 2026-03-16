import { afterEach, describe, expect, it, vi } from 'vitest';

// Configurable service data for mDNS mock
const mockServices: Record<string, unknown>[] = [
  {
    name: 'test-chromecast',
    txt: { fn: 'Living Room Speaker', id: 'device-1', md: 'Google Home' },
    host: '192.168.1.100',
    port: 8009,
    referer: { address: '192.168.1.100' },
  },
];

// Mock bonjour-service before importing the module
vi.mock('bonjour-service', () => {
  const mockBrowser = {
    stop: vi.fn(),
  };

  // Must use class/function for constructor — vi.fn arrow mock won't work with `new`
  class MockBonjour {
    find(_opts: unknown, cb: (service: unknown) => void) {
      for (const svc of mockServices) {
        cb(svc);
      }
      return mockBrowser;
    }
    destroy() {}
  }

  return { Bonjour: MockBonjour };
});

import {
  getDeviceStatuses,
  listDevices,
  resolveDevice,
  resolveDeviceById,
  setDefaultDevice,
  startDiscovery,
  stopDiscovery,
  updateActiveSessionIds,
  updateDeviceAliases,
} from '../cast-device-manager';

const defaultService = {
  name: 'test-chromecast',
  txt: { fn: 'Living Room Speaker', id: 'device-1', md: 'Google Home' },
  host: '192.168.1.100',
  port: 8009,
  referer: { address: '192.168.1.100' },
};

describe('cast-device-manager', () => {
  afterEach(() => {
    stopDiscovery();
    // Reset mock services to default for next test
    mockServices.length = 0;
    mockServices.push(defaultService);
  });

  it('discovers devices via mDNS', () => {
    startDiscovery();
    const devices = listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe('Living Room Speaker');
    expect(devices[0]?.host).toBe('192.168.1.100');
    expect(devices[0]?.port).toBe(8009);
    expect(devices[0]?.model).toBe('Google Home');
  });

  it('resolves device by exact name (case-insensitive)', () => {
    startDiscovery();
    const device = resolveDevice('living room speaker');
    expect(device.name).toBe('Living Room Speaker');
  });

  it('resolves device by partial name match', () => {
    startDiscovery();
    const device = resolveDevice('living');
    expect(device.name).toBe('Living Room Speaker');
  });

  it('returns first device when no name specified', () => {
    startDiscovery();
    const device = resolveDevice();
    expect(device.name).toBe('Living Room Speaker');
  });

  it('returns default device when set', () => {
    startDiscovery();
    setDefaultDevice('Living Room Speaker');
    const device = resolveDevice();
    expect(device.name).toBe('Living Room Speaker');
  });

  it('throws when no devices found', () => {
    // Don't start discovery — no devices
    expect(() => resolveDevice()).toThrow('No Cast devices found');
  });

  it('throws when device name not found', () => {
    startDiscovery();
    expect(() => resolveDevice('nonexistent')).toThrow('Device "nonexistent" not found');
    expect(() => resolveDevice('nonexistent')).toThrow('Available devices: Living Room Speaker');
  });

  it('clears devices on stopDiscovery', () => {
    startDiscovery();
    expect(listDevices()).toHaveLength(1);
    stopDiscovery();
    expect(listDevices()).toHaveLength(0);
  });

  it('skips service with no name (txt.fn and service.name both missing)', () => {
    mockServices.length = 0;
    mockServices.push({ txt: {}, host: '192.168.1.50', port: 8009 });
    startDiscovery();
    expect(listDevices()).toHaveLength(0);
  });

  it('falls back to service.name when txt.fn is missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'fallback-name',
      txt: { id: 'dev-2', md: 'Chromecast' },
      host: '192.168.1.60',
      port: 8009,
      referer: { address: '192.168.1.60' },
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe('fallback-name');
  });

  it('uses service.host when referer.address is missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'no-referer',
      txt: { fn: 'Kitchen Speaker', id: 'dev-3' },
      host: '192.168.1.70',
      port: 8009,
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.host).toBe('192.168.1.70');
  });

  it('uses empty string for host when both referer and host are missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'no-host',
      txt: { fn: 'Floating Speaker', id: 'dev-4' },
      port: 8009,
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.host).toBe('');
  });

  it('defaults port to 8009 when service.port is missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'no-port',
      txt: { fn: 'Default Port Speaker', id: 'dev-5' },
      host: '192.168.1.80',
      referer: { address: '192.168.1.80' },
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.port).toBe(8009);
  });

  it('falls back to service.name for id when txt.id is missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'svc-name-as-id',
      txt: { fn: 'ID Fallback Speaker' },
      host: '192.168.1.90',
      port: 8009,
      referer: { address: '192.168.1.90' },
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.id).toBe('svc-name-as-id');
  });

  it('uses name as id when both txt.id and service.name are missing', () => {
    mockServices.length = 0;
    mockServices.push({
      txt: { fn: 'Name As ID Speaker' },
      host: '192.168.1.91',
      port: 8009,
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.id).toBe('Name As ID Speaker');
  });

  it('model is undefined when txt.md is missing', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'no-model',
      txt: { fn: 'No Model Speaker', id: 'dev-6' },
      host: '192.168.1.95',
      port: 8009,
      referer: { address: '192.168.1.95' },
    });
    startDiscovery();
    const devices = listDevices();
    expect(devices[0]?.model).toBeUndefined();
  });

  it('falls back to first device when default device was removed', () => {
    mockServices.length = 0;
    mockServices.push(
      {
        name: 'dev-a',
        txt: { fn: 'Device A', id: 'a' },
        host: '192.168.1.10',
        port: 8009,
        referer: { address: '192.168.1.10' },
      },
      {
        name: 'dev-b',
        txt: { fn: 'Device B', id: 'b' },
        host: '192.168.1.11',
        port: 8009,
        referer: { address: '192.168.1.11' },
      },
    );
    startDiscovery();
    // Set default to a device name that exists in the map
    setDefaultDevice('Device A');
    // Simulate the device being removed by stopping and restarting with only Device B
    stopDiscovery();
    mockServices.length = 0;
    mockServices.push({
      name: 'dev-b',
      txt: { fn: 'Device B', id: 'b' },
      host: '192.168.1.11',
      port: 8009,
      referer: { address: '192.168.1.11' },
    });
    startDiscovery();
    // defaultDeviceName was cleared by stopDiscovery, so this just returns first
    const device = resolveDevice();
    expect(device.name).toBe('Device B');
  });

  it('matches when device key includes the query (reverse partial match)', () => {
    mockServices.length = 0;
    mockServices.push({
      name: 'lr',
      txt: { fn: 'LR', id: 'lr-1' },
      host: '192.168.1.20',
      port: 8009,
      referer: { address: '192.168.1.20' },
    });
    startDiscovery();
    // Query "lr speaker" includes key "lr" — hits the lower.includes(key) branch
    const device = resolveDevice('lr speaker');
    expect(device.name).toBe('LR');
  });

  it('stopDiscovery is safe to call when discovery was never started', () => {
    // No startDiscovery — browser and bonjour are null
    expect(() => stopDiscovery()).not.toThrow();
  });

  it('discovers multiple devices', () => {
    mockServices.length = 0;
    mockServices.push(
      {
        name: 'dev-1',
        txt: { fn: 'Speaker One', id: '1' },
        host: '192.168.1.1',
        port: 8009,
        referer: { address: '192.168.1.1' },
      },
      {
        name: 'dev-2',
        txt: { fn: 'Speaker Two', id: '2' },
        host: '192.168.1.2',
        port: 8009,
        referer: { address: '192.168.1.2' },
      },
    );
    startDiscovery();
    expect(listDevices()).toHaveLength(2);
  });

  describe('updateDeviceAliases', () => {
    it('sets aliases that resolveDevice can match', () => {
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'my speaker' });
      const device = resolveDevice('my speaker');
      expect(device.name).toBe('Living Room Speaker');
      expect(device.id).toBe('device-1');
    });

    it('clears previous aliases on update', () => {
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'alias-one' });
      updateDeviceAliases({ 'device-1': 'alias-two' });
      // Old alias no longer works — falls through to mDNS name matching
      expect(() => resolveDevice('alias-one')).toThrow('Device "alias-one" not found');
      // New alias works
      const device = resolveDevice('alias-two');
      expect(device.name).toBe('Living Room Speaker');
    });

    it('alias match is case-insensitive', () => {
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'My Speaker' });
      const device = resolveDevice('MY SPEAKER');
      expect(device.name).toBe('Living Room Speaker');
    });

    it('alias with no matching device id falls through to name match', () => {
      startDiscovery();
      updateDeviceAliases({ 'nonexistent-id': 'ghost speaker' });
      // Alias matches but device ID doesn't exist — falls through
      expect(() => resolveDevice('ghost speaker')).toThrow('Device "ghost speaker" not found');
    });
  });

  describe('resolveDeviceById', () => {
    it('returns device when id matches', () => {
      startDiscovery();
      const device = resolveDeviceById('device-1');
      expect(device).not.toBeNull();
      expect(device!.name).toBe('Living Room Speaker');
    });

    it('returns null when no device has the given id', () => {
      startDiscovery();
      const device = resolveDeviceById('nonexistent');
      expect(device).toBeNull();
    });

    it('returns null when no devices are discovered', () => {
      // Don't start discovery
      const device = resolveDeviceById('device-1');
      expect(device).toBeNull();
    });
  });

  describe('updateActiveSessionIds', () => {
    it('replaces session ids used by getDeviceStatuses', () => {
      mockServices.length = 0;
      mockServices.push(
        {
          name: 'dev-a',
          txt: { fn: 'Speaker A', id: 'id-a' },
          host: '192.168.1.1',
          port: 8009,
          referer: { address: '192.168.1.1' },
        },
        {
          name: 'dev-b',
          txt: { fn: 'Speaker B', id: 'id-b' },
          host: '192.168.1.2',
          port: 8009,
          referer: { address: '192.168.1.2' },
        },
      );
      startDiscovery();

      updateActiveSessionIds(new Set(['id-a']));
      const statuses = getDeviceStatuses();
      expect(statuses.get('id-a')).toBe('playing');
      expect(statuses.get('id-b')).toBe('available');
    });

    it('clears previous session ids on update', () => {
      startDiscovery();
      updateActiveSessionIds(new Set(['device-1']));
      expect(getDeviceStatuses().get('device-1')).toBe('playing');

      updateActiveSessionIds(new Set());
      expect(getDeviceStatuses().get('device-1')).toBe('available');
    });
  });

  describe('getDeviceStatuses', () => {
    it('returns empty map when no devices exist', () => {
      // Don't start discovery
      const statuses = getDeviceStatuses();
      expect(statuses.size).toBe(0);
    });

    it('marks all devices as available when no sessions are active', () => {
      mockServices.length = 0;
      mockServices.push(
        {
          name: 'dev-1',
          txt: { fn: 'Speaker One', id: '1' },
          host: '192.168.1.1',
          port: 8009,
          referer: { address: '192.168.1.1' },
        },
        {
          name: 'dev-2',
          txt: { fn: 'Speaker Two', id: '2' },
          host: '192.168.1.2',
          port: 8009,
          referer: { address: '192.168.1.2' },
        },
      );
      startDiscovery();
      const statuses = getDeviceStatuses();
      expect(statuses.size).toBe(2);
      expect(statuses.get('1')).toBe('available');
      expect(statuses.get('2')).toBe('available');
    });

    it('marks devices with active sessions as playing', () => {
      mockServices.length = 0;
      mockServices.push(
        {
          name: 'dev-1',
          txt: { fn: 'Speaker One', id: '1' },
          host: '192.168.1.1',
          port: 8009,
          referer: { address: '192.168.1.1' },
        },
        {
          name: 'dev-2',
          txt: { fn: 'Speaker Two', id: '2' },
          host: '192.168.1.2',
          port: 8009,
          referer: { address: '192.168.1.2' },
        },
      );
      startDiscovery();
      updateActiveSessionIds(new Set(['2']));
      const statuses = getDeviceStatuses();
      expect(statuses.get('1')).toBe('available');
      expect(statuses.get('2')).toBe('playing');
    });
  });
});
