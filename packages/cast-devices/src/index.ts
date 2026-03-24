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

// --- State ---

const devices = new Map<string, CastDevice>();
let bonjour: BonjourInstance | null = null;
let browser: Browser | null = null;
let refCount = 0;

// --- Lifecycle (refcounted — multiple plugins can start/stop independently) ---

export const startDiscovery = (): void => {
  refCount++;
  if (bonjour) {
    return; // Already running
  }
  bonjour = new Bonjour();
  browser = bonjour.find({ type: 'googlecast' }, (service: Service) => {
    const device = serviceToDevice(service);
    if (device) {
      devices.set(device.name.toLowerCase(), device);
    }
  });
};

export const stopDiscovery = (): void => {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) {
    return; // Other consumers still need it
  }
  browser?.stop();
  browser = null;
  bonjour?.destroy();
  bonjour = null;
  devices.clear();
};

// --- Device lookup ---

export const listDevices = (): CastDevice[] => {
  return Array.from(devices.values());
};

export const resolveDevice = (deviceName?: string): CastDevice => {
  if (devices.size === 0) {
    throw new Error('No Cast devices found on the network. Make sure devices are on the same LAN.');
  }

  // If no name specified, return first discovered
  if (!deviceName) {
    const first = devices.values().next().value;
    if (!first) {
      throw new Error('No Cast devices available.');
    }
    return first;
  }

  // Exact match (case-insensitive)
  const lower = deviceName.toLowerCase();
  const exact = devices.get(lower);
  if (exact) {
    return exact;
  }

  // Partial match
  for (const [key, device] of devices) {
    if (key.includes(lower) || lower.includes(key)) {
      return device;
    }
  }

  const available = Array.from(devices.values())
    .map((d) => d.name)
    .join(', ');
  throw new Error(`Device "${deviceName}" not found. Available devices: ${available}`);
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
