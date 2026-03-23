import type {
  GoveeClientConfig,
  GoveeControlResponse,
  GoveeDevice,
  GoveeDeviceListResponse,
  GoveeDeviceState,
  GoveeDeviceStateResponse,
  GoveeError,
} from './govee-types';
import type { RateLimiter } from './rate-limiter';

const BASE_URL = 'https://openapi.api.govee.com';

type ControlCapability = {
  type: string;
  instance: string;
  value: unknown;
};

export type GoveeClient = {
  listDevices: () => Promise<GoveeDevice[]>;
  getDeviceState: (sku: string, device: string) => Promise<GoveeDeviceState>;
  controlDevice: (sku: string, device: string, capability: ControlCapability) => Promise<void>;
};

type CreateGoveeClient = (config: GoveeClientConfig, rateLimiter: RateLimiter) => GoveeClient;

const makeGoveeError = (type: GoveeError['type'], message: string, statusCode?: number): GoveeError => ({
  type,
  message,
  statusCode,
});

const classifyHttpError = (status: number, message: string): GoveeError => {
  if (status === 401) {
    return makeGoveeError('AUTH_FAILED', message, status);
  }
  if (status === 429) {
    return makeGoveeError('RATE_LIMITED', message, status);
  }
  return makeGoveeError('API_ERROR', message, status);
};

const generateRequestId = (): string => crypto.randomUUID();

export const createGoveeClient: CreateGoveeClient = (config, rateLimiter) => {
  const headers = {
    'Govee-API-Key': config.apiKey,
    'Content-Type': 'application/json',
  };

  const request = async <T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> => {
    const { method = 'GET', body } = options;
    const url = `${BASE_URL}${path}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await response.json()) as { code: number; message: string };

    if (!response.ok) {
      throw classifyHttpError(response.status, json.message ?? `HTTP ${response.status}`);
    }

    return json as T;
  };

  return {
    listDevices: async () => {
      const result = await request<GoveeDeviceListResponse>('/router/api/v1/user/devices');
      return result.data;
    },

    getDeviceState: async (sku, device) => {
      const result = await request<GoveeDeviceStateResponse>('/router/api/v1/device/state', {
        method: 'POST',
        body: {
          requestId: generateRequestId(),
          payload: { sku, device },
        },
      });
      return result.payload;
    },

    controlDevice: async (sku, device, capability) => {
      // Check rate limiter before sending
      const limiterResult = rateLimiter.tryAcquire(device);
      if (!limiterResult.allowed) {
        throw makeGoveeError(
          'RATE_LIMITED',
          `Rate limit reached for device ${device}. Try again in ${Math.ceil(limiterResult.retryAfterMs / 1000)}s.`,
        );
      }

      await request<GoveeControlResponse>('/router/api/v1/device/control', {
        method: 'POST',
        body: {
          requestId: generateRequestId(),
          payload: { sku, device, capability },
        },
      });
    },
  };
};
