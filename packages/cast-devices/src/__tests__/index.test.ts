import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CastDevice, listDevices, resolveDevice, startDiscovery, stopDiscovery } from '../index';

// Mock bonjour-service
let serviceCallback: ((service: Record<string, unknown>) => void) | null = null;

vi.mock('bonjour-service', () => {
  const mockBrowser = { stop: vi.fn() };

  class MockBonjour {
    find(_opts: Record<string, unknown>, cb: (service: Record<string, unknown>) => void) {
      serviceCallback = cb;
      return mockBrowser;
    }
    destroy() {}
  }

  return { Bonjour: MockBonjour };
});

const emitService = (service: Record<string, unknown>) => {
  serviceCallback?.(service);
};

afterEach(() => {
  stopDiscovery();
  serviceCallback = null;
});

describe('cast-devices', () => {
  describe('startDiscovery / stopDiscovery', () => {
    it('starts Bonjour discovery for googlecast devices', () => {
      startDiscovery();
    });

    it('stops cleanly', () => {
      startDiscovery();
      stopDiscovery();
    });

    it('handles double-stop without error', () => {
      startDiscovery();
      stopDiscovery();
      stopDiscovery();
    });

    it('is refcounted — second start is a no-op, first stop keeps running', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Speaker A', id: 'a1' },
        referer: { address: '192.168.1.10' },
        port: 8009,
        name: 'a',
      });

      startDiscovery(); // Second consumer starts
      stopDiscovery(); // First consumer stops — refcount still > 0

      // Devices should still be available
      expect(listDevices()).toHaveLength(1);

      stopDiscovery(); // Second consumer stops — refcount hits 0, clears
      expect(listDevices()).toHaveLength(0);
    });
  });

  describe('listDevices', () => {
    it('returns empty array when no devices discovered', () => {
      startDiscovery();
      expect(listDevices()).toEqual([]);
    });

    it('returns discovered devices', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Living Room', id: 'device-1', md: 'Google Home' },
        referer: { address: '192.168.1.10' },
        port: 8009,
        name: 'living-room',
      });

      const devices = listDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual({
        name: 'Living Room',
        host: '192.168.1.10',
        port: 8009,
        id: 'device-1',
        model: 'Google Home',
      });
    });

    it('discovers multiple devices', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Kitchen', id: 'k1', md: 'Nest Mini' },
        referer: { address: '192.168.1.20' },
        port: 8009,
        name: 'kitchen',
      });
      emitService({
        txt: { fn: 'Bedroom', id: 'b1', md: 'Nest Hub' },
        referer: { address: '192.168.1.30' },
        port: 8009,
        name: 'bedroom',
      });

      expect(listDevices()).toHaveLength(2);
    });
  });

  describe('resolveDevice', () => {
    it('resolves by exact name (case-insensitive)', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Kitchen Speaker', id: 'k1', md: 'Nest Mini' },
        referer: { address: '192.168.1.20' },
        port: 8009,
        name: 'kitchen',
      });

      const device = resolveDevice('kitchen speaker');
      expect(device.id).toBe('k1');
    });

    it('resolves by partial name match', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Bedroom Nest Hub', id: 'b1' },
        referer: { address: '192.168.1.30' },
        port: 8009,
        name: 'bedroom',
      });

      const device = resolveDevice('bedroom');
      expect(device.id).toBe('b1');
    });

    it('returns first device when no name specified', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Office', id: 'o1' },
        referer: { address: '192.168.1.40' },
        port: 8009,
        name: 'office',
      });

      const device = resolveDevice();
      expect(device.id).toBe('o1');
    });

    it('throws when no devices are discovered', () => {
      startDiscovery();
      expect(() => resolveDevice()).toThrow('No Cast devices found');
    });

    it('throws when named device is not found', () => {
      startDiscovery();
      emitService({
        txt: { fn: 'Living Room', id: 'lr1' },
        referer: { address: '192.168.1.10' },
        port: 8009,
        name: 'living-room',
      });

      expect(() => resolveDevice('garage')).toThrow('Device "garage" not found');
    });
  });

  describe('serviceToDevice edge cases', () => {
    it('skips services without a name', () => {
      startDiscovery();
      emitService({ txt: {}, referer: { address: '192.168.1.50' }, port: 8009 });
      expect(listDevices()).toEqual([]);
    });

    it('falls back to service.host when referer is missing', () => {
      startDiscovery();
      emitService({ txt: { fn: 'Fallback', id: 'fh1' }, host: '10.0.0.1', port: 8009, name: 'fb' });
      expect(listDevices()[0]?.host).toBe('10.0.0.1');
    });

    it('uses default port when port is missing', () => {
      startDiscovery();
      emitService({ txt: { fn: 'NoPort', id: 'np1' }, referer: { address: '192.168.1.60' }, name: 'np' });
      expect(listDevices()[0]?.port).toBe(8009);
    });

    it('falls back to service.name when txt.fn is missing', () => {
      startDiscovery();
      emitService({ txt: { id: 'sn1' }, referer: { address: '192.168.1.70' }, port: 8009, name: 'SvcName' });
      expect(listDevices()[0]?.name).toBe('SvcName');
    });

    it('uses name as id fallback', () => {
      startDiscovery();
      emitService({ txt: { fn: 'NameId' }, referer: { address: '192.168.1.80' }, port: 8009 });
      expect(listDevices()[0]?.id).toBe('NameId');
    });

    it('falls back to empty host', () => {
      startDiscovery();
      emitService({ txt: { fn: 'NoHost', id: 'nh1' }, port: 8009, name: 'nh' });
      expect(listDevices()[0]?.host).toBe('');
    });
  });

  describe('CastDevice type', () => {
    it('exports the CastDevice type', () => {
      const device: CastDevice = {
        name: 'Test',
        host: '192.168.1.1',
        port: 8009,
        id: 'test-1',
        model: undefined,
      };
      expect(device.name).toBe('Test');
    });
  });
});
