import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock data for the shared cast-devices package
const sharedDevices: Array<{
  name: string;
  host: string;
  port: number;
  id: string;
  model: string | undefined;
}> = [];

vi.mock('@harness/cast-devices', () => ({
  startDiscovery: vi.fn(),
  stopDiscovery: vi.fn(() => {
    sharedDevices.length = 0;
  }),
  listDevices: vi.fn(() => [...sharedDevices]),
  resolveDevice: vi.fn((deviceName?: string) => {
    if (sharedDevices.length === 0) {
      throw new Error('No Cast devices found on the network. Make sure devices are on the same LAN.');
    }
    if (!deviceName) {
      return sharedDevices[0];
    }
    const lower = deviceName.toLowerCase();
    const exact = sharedDevices.find((d) => d.name.toLowerCase() === lower);
    if (exact) {
      return exact;
    }
    const partial = sharedDevices.find((d) => d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase()));
    if (partial) {
      return partial;
    }
    throw new Error(`Device "${deviceName}" not found. Available devices: ${sharedDevices.map((d) => d.name).join(', ')}`);
  }),
}));

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

const defaultDevice = {
  name: 'Living Room Speaker',
  host: '192.168.1.100',
  port: 8009,
  id: 'device-1',
  model: 'Google Home' as string | undefined,
};

describe('cast-device-manager', () => {
  afterEach(() => {
    stopDiscovery();
    sharedDevices.length = 0;
  });

  it('delegates startDiscovery to shared package', () => {
    startDiscovery();
  });

  it('delegates listDevices to shared package', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    const devices = listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe('Living Room Speaker');
  });

  it('resolves device by name via shared resolveDevice', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    const device = resolveDevice('living room speaker');
    expect(device.name).toBe('Living Room Speaker');
  });

  it('resolves device by partial name match', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    const device = resolveDevice('living');
    expect(device.name).toBe('Living Room Speaker');
  });

  it('returns first device when no name specified', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    const device = resolveDevice();
    expect(device.name).toBe('Living Room Speaker');
  });

  it('returns default device when set', () => {
    sharedDevices.push(defaultDevice, { name: 'Kitchen', host: '192.168.1.20', port: 8009, id: 'k1', model: undefined });
    startDiscovery();
    setDefaultDevice('Living Room Speaker');
    const device = resolveDevice();
    expect(device.name).toBe('Living Room Speaker');
  });

  it('throws when no devices found', () => {
    expect(() => resolveDevice()).toThrow('No Cast devices found');
  });

  it('throws when device name not found', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    expect(() => resolveDevice('nonexistent')).toThrow('Device "nonexistent" not found');
  });

  it('clears devices on stopDiscovery', () => {
    sharedDevices.push(defaultDevice);
    startDiscovery();
    expect(listDevices()).toHaveLength(1);
    stopDiscovery();
    expect(listDevices()).toHaveLength(0);
  });

  it('falls back to first device when default device was removed', () => {
    sharedDevices.push({ name: 'Device B', host: '192.168.1.11', port: 8009, id: 'b', model: undefined });
    startDiscovery();
    // Default was set to a device that no longer exists
    setDefaultDevice('Device A');
    const device = resolveDevice();
    // Should fall back to first available (Device B)
    expect(device.name).toBe('Device B');
  });

  it('discovers multiple devices', () => {
    sharedDevices.push(
      { name: 'Speaker One', host: '192.168.1.1', port: 8009, id: '1', model: undefined },
      { name: 'Speaker Two', host: '192.168.1.2', port: 8009, id: '2', model: undefined },
    );
    startDiscovery();
    expect(listDevices()).toHaveLength(2);
  });

  describe('updateDeviceAliases', () => {
    it('sets aliases that resolveDevice can match', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'my speaker' });
      const device = resolveDevice('my speaker');
      expect(device.name).toBe('Living Room Speaker');
      expect(device.id).toBe('device-1');
    });

    it('clears previous aliases on update', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'alias-one' });
      updateDeviceAliases({ 'device-1': 'alias-two' });
      // Old alias no longer works
      expect(() => resolveDevice('alias-one')).toThrow('Device "alias-one" not found');
      // New alias works
      const device = resolveDevice('alias-two');
      expect(device.name).toBe('Living Room Speaker');
    });

    it('alias match is case-insensitive', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      updateDeviceAliases({ 'device-1': 'My Speaker' });
      const device = resolveDevice('MY SPEAKER');
      expect(device.name).toBe('Living Room Speaker');
    });

    it('alias with no matching device id falls through to name match', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      updateDeviceAliases({ 'nonexistent-id': 'ghost speaker' });
      expect(() => resolveDevice('ghost speaker')).toThrow('Device "ghost speaker" not found');
    });
  });

  describe('resolveDeviceById', () => {
    it('returns device when id matches', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      const device = resolveDeviceById('device-1');
      expect(device).not.toBeNull();
      expect(device!.name).toBe('Living Room Speaker');
    });

    it('returns null when no device has the given id', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      const device = resolveDeviceById('nonexistent');
      expect(device).toBeNull();
    });

    it('returns null when no devices are discovered', () => {
      const device = resolveDeviceById('device-1');
      expect(device).toBeNull();
    });
  });

  describe('updateActiveSessionIds', () => {
    it('replaces session ids used by getDeviceStatuses', () => {
      sharedDevices.push(
        { name: 'Speaker A', host: '192.168.1.1', port: 8009, id: 'id-a', model: undefined },
        { name: 'Speaker B', host: '192.168.1.2', port: 8009, id: 'id-b', model: undefined },
      );
      startDiscovery();

      updateActiveSessionIds(new Set(['id-a']));
      const statuses = getDeviceStatuses();
      expect(statuses.get('id-a')).toBe('playing');
      expect(statuses.get('id-b')).toBe('available');
    });

    it('clears previous session ids on update', () => {
      sharedDevices.push(defaultDevice);
      startDiscovery();
      updateActiveSessionIds(new Set(['device-1']));
      expect(getDeviceStatuses().get('device-1')).toBe('playing');

      updateActiveSessionIds(new Set());
      expect(getDeviceStatuses().get('device-1')).toBe('available');
    });
  });

  describe('getDeviceStatuses', () => {
    it('returns empty map when no devices exist', () => {
      const statuses = getDeviceStatuses();
      expect(statuses.size).toBe(0);
    });

    it('marks all devices as available when no sessions are active', () => {
      sharedDevices.push(
        { name: 'Speaker One', host: '192.168.1.1', port: 8009, id: '1', model: undefined },
        { name: 'Speaker Two', host: '192.168.1.2', port: 8009, id: '2', model: undefined },
      );
      startDiscovery();
      const statuses = getDeviceStatuses();
      expect(statuses.size).toBe(2);
      expect(statuses.get('1')).toBe('available');
      expect(statuses.get('2')).toBe('available');
    });

    it('marks devices with active sessions as playing', () => {
      sharedDevices.push(
        { name: 'Speaker One', host: '192.168.1.1', port: 8009, id: '1', model: undefined },
        { name: 'Speaker Two', host: '192.168.1.2', port: 8009, id: '2', model: undefined },
      );
      startDiscovery();
      updateActiveSessionIds(new Set(['2']));
      const statuses = getDeviceStatuses();
      expect(statuses.get('1')).toBe('available');
      expect(statuses.get('2')).toBe('playing');
    });
  });
});
