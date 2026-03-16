import { Bonjour, type Service } from 'bonjour-service';

// --- Types ---

export type CastDevice = {
  name: string;
  host: string;
  port: number;
  id: string;
  model: string | undefined;
};

type BonjourInstance = InstanceType<typeof Bonjour>;
type Browser = ReturnType<BonjourInstance['find']>;

type DeviceStatus = 'available' | 'playing' | 'offline';

// --- State ---

const devices = new Map<string, CastDevice>();
let bonjour: BonjourInstance | null = null;
let browser: Browser | null = null;
let defaultDeviceName: string | null = null;
const deviceAliases: Record<string, string> = {};
const activeSessionIds = new Set<string>();

// --- Lifecycle ---

export const startDiscovery = (): void => {
  bonjour = new Bonjour();
  browser = bonjour.find({ type: 'googlecast' }, (service: Service) => {
    const device = serviceToDevice(service);
    if (device) {
      devices.set(device.name.toLowerCase(), device);
    }
  });
};

export const stopDiscovery = (): void => {
  browser?.stop();
  browser = null;
  bonjour?.destroy();
  bonjour = null;
  devices.clear();
  defaultDeviceName = null;
};

// --- Device lookup ---

export const listDevices = (): CastDevice[] => {
  return Array.from(devices.values());
};

export const resolveDevice = (deviceName?: string): CastDevice => {
  if (devices.size === 0) {
    throw new Error('No Cast devices found on the network. Make sure devices are on the same LAN.');
  }

  // If no name specified, use last-used or first discovered
  if (!deviceName) {
    if (defaultDeviceName) {
      const dev = devices.get(defaultDeviceName);
      if (dev) {
        return dev;
      }
    }
    const first = devices.values().next().value;
    if (!first) {
      throw new Error('No Cast devices available.');
    }
    return first;
  }

  // Check aliases — find device whose ID maps to this alias
  const aliasLower = deviceName.toLowerCase();
  for (const [id, alias] of Object.entries(deviceAliases)) {
    if (alias.toLowerCase() === aliasLower) {
      // Find device by ID
      for (const device of devices.values()) {
        if (device.id === id) {
          defaultDeviceName = device.name.toLowerCase();
          return device;
        }
      }
    }
  }

  // Exact match (case-insensitive)
  const lower = deviceName.toLowerCase();
  const exact = devices.get(lower);
  if (exact) {
    defaultDeviceName = lower;
    return exact;
  }

  // Partial match
  for (const [key, device] of devices) {
    if (key.includes(lower) || lower.includes(key)) {
      defaultDeviceName = key;
      return device;
    }
  }

  const available = Array.from(devices.values())
    .map((d) => d.name)
    .join(', ');
  throw new Error(`Device "${deviceName}" not found. Available devices: ${available}`);
};

export const setDefaultDevice = (name: string): void => {
  defaultDeviceName = name.toLowerCase();
};

// --- Alias management ---

export const updateDeviceAliases = (aliases: Record<string, string>): void => {
  // Clear and repopulate (cannot reassign — biome enforces const)
  for (const key of Object.keys(deviceAliases)) {
    delete deviceAliases[key];
  }
  Object.assign(deviceAliases, aliases);
};

// --- Device by ID ---

export const resolveDeviceById = (deviceId: string): CastDevice | null => {
  for (const device of devices.values()) {
    if (device.id === deviceId) {
      return device;
    }
  }
  return null;
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
  for (const device of devices.values()) {
    if (activeSessionIds.has(device.id)) {
      statuses.set(device.id, 'playing');
    } else {
      statuses.set(device.id, 'available');
    }
  }
  return statuses;
};

// --- Helpers ---

const serviceToDevice = (service: Service): CastDevice | null => {
  const name = service.txt?.fn ?? service.name;
  if (!name) {
    return null;
  }

  return {
    name,
    host: service.referer?.address ?? service.host ?? '',
    port: service.port ?? 8009,
    id: service.txt?.id ?? service.name ?? name,
    model: service.txt?.md,
  };
};
