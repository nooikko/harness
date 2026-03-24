// Re-exports core discovery from shared @harness/cast-devices package.
// Music-specific extras (aliases, session tracking, default device) live here.

import {
  type CastDevice,
  listDevices as sharedListDevices,
  resolveDevice as sharedResolveDevice,
  startDiscovery,
  stopDiscovery,
} from '@harness/cast-devices';

export type { CastDevice };
export { startDiscovery, stopDiscovery };

type DeviceStatus = 'available' | 'playing' | 'offline';

// --- Music-specific state ---

let defaultDeviceName: string | null = null;
const deviceAliases: Record<string, string> = {};
const activeSessionIds = new Set<string>();

// --- Device lookup (wraps shared with alias + default device support) ---

export const listDevices = (): CastDevice[] => {
  return sharedListDevices();
};

export const resolveDevice = (deviceName?: string): CastDevice => {
  const devices = sharedListDevices();

  if (devices.length === 0) {
    throw new Error('No Cast devices found on the network. Make sure devices are on the same LAN.');
  }

  // If no name specified, use last-used or first discovered
  if (!deviceName) {
    if (defaultDeviceName) {
      const dev = devices.find((d) => d.name.toLowerCase() === defaultDeviceName);
      if (dev) {
        return dev;
      }
    }
    return sharedResolveDevice();
  }

  // Check aliases — find device whose ID maps to this alias
  const aliasLower = deviceName.toLowerCase();
  for (const [id, alias] of Object.entries(deviceAliases)) {
    if (alias.toLowerCase() === aliasLower) {
      const device = devices.find((d) => d.id === id);
      if (device) {
        defaultDeviceName = device.name.toLowerCase();
        return device;
      }
    }
  }

  // Delegate to shared resolver for exact/partial match
  const device = sharedResolveDevice(deviceName);
  defaultDeviceName = device.name.toLowerCase();
  return device;
};

export const setDefaultDevice = (name: string): void => {
  defaultDeviceName = name.toLowerCase();
};

// --- Alias management ---

export const updateDeviceAliases = (aliases: Record<string, string>): void => {
  for (const key of Object.keys(deviceAliases)) {
    delete deviceAliases[key];
  }
  Object.assign(deviceAliases, aliases);
};

// --- Device by ID ---

export const resolveDeviceById = (deviceId: string): CastDevice | null => {
  const devices = sharedListDevices();
  return devices.find((d) => d.id === deviceId) ?? null;
};

// --- Session tracking ---

export const updateActiveSessionIds = (ids: Set<string>): void => {
  activeSessionIds.clear();
  for (const id of ids) {
    activeSessionIds.add(id);
  }
};

export const getDeviceStatuses = (): Map<string, DeviceStatus> => {
  const statuses = new Map<string, DeviceStatus>();
  for (const device of sharedListDevices()) {
    if (activeSessionIds.has(device.id)) {
      statuses.set(device.id, 'playing');
    } else {
      statuses.set(device.id, 'available');
    }
  }
  return statuses;
};
