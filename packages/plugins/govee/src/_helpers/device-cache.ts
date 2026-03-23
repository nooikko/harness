import type { GoveeClient } from './govee-client';
import type { GoveeDevice } from './govee-types';

export type DeviceCache = {
  readonly devices: GoveeDevice[];
  refresh: () => Promise<void>;
  clear: () => void;
  findByName: (name: string) => GoveeDevice | undefined;
  findByMac: (mac: string) => GoveeDevice | undefined;
  hasCapability: (device: GoveeDevice, instance: string) => boolean;
};

type CreateDeviceCache = (client: GoveeClient) => DeviceCache;

const fuzzyMatch = (haystack: string, needle: string): boolean => {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  return h === n || h.includes(n) || h.startsWith(n);
};

export const createDeviceCache: CreateDeviceCache = (client) => {
  let devices: GoveeDevice[] = [];

  return {
    get devices() {
      return devices;
    },

    refresh: async () => {
      devices = await client.listDevices();
    },

    clear: () => {
      devices = [];
    },

    findByName: (name) => devices.find((d) => fuzzyMatch(d.deviceName, name)),

    findByMac: (mac) => {
      const lower = mac.toLowerCase();
      return devices.find((d) => d.device.toLowerCase() === lower);
    },

    hasCapability: (device, instance) => device.capabilities.some((c) => c.instance === instance),
  };
};
