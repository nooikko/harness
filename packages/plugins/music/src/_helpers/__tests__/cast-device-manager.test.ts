import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock bonjour-service before importing the module
vi.mock('bonjour-service', () => {
  const mockBrowser = {
    stop: vi.fn(),
  };

  // Must use class/function for constructor — vi.fn arrow mock won't work with `new`
  class MockBonjour {
    find(_opts: unknown, cb: (service: unknown) => void) {
      cb({
        name: 'test-chromecast',
        txt: { fn: 'Living Room Speaker', id: 'device-1', md: 'Google Home' },
        host: '192.168.1.100',
        port: 8009,
        referer: { address: '192.168.1.100' },
      });
      return mockBrowser;
    }
    destroy() {}
  }

  return { default: MockBonjour };
});

import { listDevices, resolveDevice, setDefaultDevice, startDiscovery, stopDiscovery } from '../cast-device-manager';

describe('cast-device-manager', () => {
  afterEach(() => {
    stopDiscovery();
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
});
