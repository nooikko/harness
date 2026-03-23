/** Govee Cloud API v2 types */

export type GoveeCapability = {
  type: string;
  instance: string;
  parameters?: {
    dataType?: string;
    range?: { min: number; max: number; precision: number };
    options?: Array<{ name: string; value: unknown }>;
    fields?: Array<{ fieldName: string; dataType: string; range?: { min: number; max: number } }>;
  };
};

export type GoveeDevice = {
  sku: string;
  device: string; // MAC address
  deviceName: string;
  type: string;
  capabilities: GoveeCapability[];
};

export type GoveeDeviceListResponse = {
  code: number;
  message: string;
  data: GoveeDevice[];
};

export type GoveeDeviceState = {
  sku: string;
  device: string;
  capabilities: Array<{
    type: string;
    instance: string;
    state: {
      value: unknown;
    };
  }>;
};

export type GoveeDeviceStateResponse = {
  code: number;
  message: string;
  payload: GoveeDeviceState;
};

export type GoveeControlPayload = {
  sku: string;
  device: string;
  capability: {
    type: string;
    instance: string;
    value: unknown;
  };
};

export type GoveeControlRequest = {
  requestId: string;
  payload: GoveeControlPayload;
};

export type GoveeControlResponse = {
  code: number;
  message: string;
};

export type GoveeSceneCapability = {
  type: 'devices.capabilities.mode';
  instance: 'lightScene' | 'diyScene';
  parameters: {
    options: Array<{ name: string; value: unknown }>;
  };
};

export type GoveeError = {
  type: 'AUTH_FAILED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'API_ERROR';
  message: string;
  statusCode?: number;
};

export type GoveeClientConfig = {
  apiKey: string;
};
