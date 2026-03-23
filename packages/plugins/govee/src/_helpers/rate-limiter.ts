type RateLimiterConfig = {
  perDevicePerMinute: number;
  dailyLimit: number;
};

type AcquireResult = { allowed: true; retryAfterMs?: never } | { allowed: false; retryAfterMs: number };

type DeviceStatus = {
  used: number;
  remaining: number;
  limit: number;
};

type RateLimiterStatus = {
  dailyUsed: number;
  dailyLimit: number;
  devices: Record<string, number>;
};

export type RateLimiter = {
  tryAcquire: (deviceId: string) => AcquireResult;
  getStatus: () => RateLimiterStatus;
  getDeviceStatus: (deviceId: string) => DeviceStatus;
  reset: () => void;
};

type CreateRateLimiter = (config: RateLimiterConfig) => RateLimiter;

const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const createRateLimiter: CreateRateLimiter = (config) => {
  const deviceWindows = new Map<string, number[]>();
  let dailyCount = 0;
  let dailyResetAt = Date.now() + DAY_MS;

  const pruneDevice = (deviceId: string): number[] => {
    const timestamps = deviceWindows.get(deviceId) ?? [];
    const cutoff = Date.now() - WINDOW_MS;
    const active = timestamps.filter((t) => t > cutoff);
    if (active.length > 0) {
      deviceWindows.set(deviceId, active);
    } else {
      deviceWindows.delete(deviceId);
    }
    return active;
  };

  const checkDailyReset = () => {
    if (Date.now() >= dailyResetAt) {
      dailyCount = 0;
      dailyResetAt = Date.now() + DAY_MS;
    }
  };

  return {
    tryAcquire: (deviceId) => {
      checkDailyReset();

      // Check daily limit
      if (dailyCount >= config.dailyLimit) {
        return {
          allowed: false,
          retryAfterMs: dailyResetAt - Date.now(),
        };
      }

      // Check per-device limit
      const active = pruneDevice(deviceId);
      if (active.length >= config.perDevicePerMinute) {
        const oldest = active[0]!;
        const retryAfterMs = oldest + WINDOW_MS - Date.now();
        return {
          allowed: false,
          retryAfterMs: Math.max(1, retryAfterMs),
        };
      }

      // Record the request
      const now = Date.now();
      active.push(now);
      deviceWindows.set(deviceId, active);
      dailyCount++;

      return { allowed: true };
    },

    getStatus: () => {
      checkDailyReset();
      const devices: Record<string, number> = {};
      for (const [id] of deviceWindows) {
        const active = pruneDevice(id);
        if (active.length > 0) {
          devices[id] = active.length;
        }
      }
      return {
        dailyUsed: dailyCount,
        dailyLimit: config.dailyLimit,
        devices,
      };
    },

    getDeviceStatus: (deviceId) => {
      const active = pruneDevice(deviceId);
      return {
        used: active.length,
        remaining: Math.max(0, config.perDevicePerMinute - active.length),
        limit: config.perDevicePerMinute,
      };
    },

    reset: () => {
      deviceWindows.clear();
      dailyCount = 0;
      dailyResetAt = Date.now() + DAY_MS;
    },
  };
};
