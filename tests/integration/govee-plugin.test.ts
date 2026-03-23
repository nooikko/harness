import { PrismaClient } from '@harness/database';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// --- Govee Cloud API mock types (inline to avoid import path issues) ---

type MockGoveeDevice = {
  sku: string;
  device: string;
  deviceName: string;
  type: string;
  capabilities: Array<{
    type: string;
    instance: string;
    parameters?: {
      dataType?: string;
      range?: { min: number; max: number; precision: number };
      options?: Array<{ name: string; value: unknown }>;
    };
  }>;
};

// --- Mock fetch for Govee Cloud API ---

const mockDevices: MockGoveeDevice[] = [
  {
    sku: 'H6008',
    device: 'AA:BB:CC:DD:EE:FF:00:01',
    deviceName: 'Living Room Light',
    type: 'devices.types.light',
    capabilities: [
      { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
      {
        type: 'devices.capabilities.range',
        instance: 'brightness',
        parameters: { dataType: 'INTEGER', range: { min: 1, max: 100, precision: 1 } },
      },
      { type: 'devices.capabilities.color_setting', instance: 'colorRgb' },
      { type: 'devices.capabilities.color_setting', instance: 'colorTemperatureK' },
      {
        type: 'devices.capabilities.mode',
        instance: 'lightScene',
        parameters: {
          options: [
            { name: 'Sunset', value: 101 },
            { name: 'Movie', value: 102 },
          ],
        },
      },
    ],
  },
  {
    sku: 'H6159',
    device: 'AA:BB:CC:DD:EE:FF:00:02',
    deviceName: 'Bedroom Strip',
    type: 'devices.types.light',
    capabilities: [
      { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
      { type: 'devices.capabilities.range', instance: 'brightness' },
      { type: 'devices.capabilities.color_setting', instance: 'colorRgb' },
    ],
  },
];

const fetchSpy = vi.fn();
const originalFetch = global.fetch;
global.fetch = fetchSpy as unknown as typeof fetch;

const resetFetchMock = () => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(async (url: string) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.includes('/user/devices')) {
      return { ok: true, status: 200, json: () => Promise.resolve({ code: 200, message: 'success', data: mockDevices }) };
    }
    if (urlStr.includes('/device/state')) {
      return {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            code: 200,
            message: 'success',
            payload: {
              sku: 'H6008',
              device: 'AA:BB:CC:DD:EE:FF:00:01',
              capabilities: [
                { type: 'devices.capabilities.on_off', instance: 'powerSwitch', state: { value: 1 } },
                { type: 'devices.capabilities.range', instance: 'brightness', state: { value: 75 } },
              ],
            },
          }),
      };
    }
    if (urlStr.includes('/device/control')) {
      return { ok: true, status: 200, json: () => Promise.resolve({ code: 200, message: 'success' }) };
    }
    return { ok: true, status: 200, json: () => Promise.resolve({ code: 200, message: 'ok' }) };
  });
};

// Import plugin after fetch mock is installed
const { goveePlugin } = await import('@harness/plugin-govee');

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
  resetFetchMock();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  global.fetch = originalFetch;
  await prisma.$disconnect();
});

const seedApiKey = async (db: PrismaClient) => {
  await db.pluginConfig.upsert({
    where: { pluginName: 'govee' },
    create: { pluginName: 'govee', enabled: true, settings: { apiKey: 'test-govee-api-key' } },
    update: { settings: { apiKey: 'test-govee-api-key' } },
  });
};

const getTool = (name: string) => {
  const tool = goveePlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in govee plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

describe('govee plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('registers and starts in degraded mode without API key', async () => {
    harness = await createTestHarness(goveePlugin);
    expect(harness.orchestrator).toBeDefined();
  });

  it('starts healthy when API key is configured', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/user/devices'), expect.any(Object));
  });

  it('list_devices returns formatted device list', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('list_devices');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Living Room Light');
    expect(text).toContain('Bedroom Strip');
    expect(text).toContain('H6008');
  });

  it('set_light sends on/off capability to correct device', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('set_light');
    const result = await tool.handler(ctx, { device: 'Living Room', on: true }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Updated');
    expect(text).toContain('Living Room Light');

    const controlCalls = fetchSpy.mock.calls.filter((c: [string, RequestInit?]) => (c[0] as string).includes('/device/control'));
    expect(controlCalls.length).toBeGreaterThan(0);

    const body = JSON.parse(controlCalls[0]![1]!.body as string);
    expect(body.payload.capability.instance).toBe('powerSwitch');
    expect(body.payload.capability.value).toBe(1);
  });

  it('set_light with named color resolves to RGB int', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('set_light');
    await tool.handler(ctx, { device: 'Bedroom Strip', color: 'red' }, makeMeta(harness.threadId));

    const controlCalls = fetchSpy.mock.calls.filter((c: [string, RequestInit?]) => (c[0] as string).includes('/device/control'));
    const colorCall = controlCalls.find((c: [string, RequestInit?]) => {
      const body = JSON.parse(c[1]!.body as string);
      return body.payload.capability.instance === 'colorRgb';
    });

    expect(colorCall).toBeDefined();
    const body = JSON.parse(colorCall![1]!.body as string);
    expect(body.payload.capability.value).toBe(0xff0000);
  });

  it('toggle_light reads state then inverts', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('toggle_light');
    const result = await tool.handler(ctx, { device: 'Living Room' }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('OFF'); // Was ON → toggled OFF

    const stateCalls = fetchSpy.mock.calls.filter((c: [string, RequestInit?]) => (c[0] as string).includes('/device/state'));
    const controlCalls = fetchSpy.mock.calls.filter((c: [string, RequestInit?]) => (c[0] as string).includes('/device/control'));
    expect(stateCalls.length).toBeGreaterThan(0);
    expect(controlCalls.length).toBeGreaterThan(0);
  });

  it('rate limiter blocks after 10 requests to same device', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('set_light');

    for (let i = 0; i < 10; i++) {
      const result = await tool.handler(ctx, { device: 'Living Room', on: true }, makeMeta(harness.threadId));
      const text = typeof result === 'string' ? result : result.text;
      expect(text).toContain('Updated');
    }

    // 11th request should be rate limited
    await expect(tool.handler(ctx, { device: 'Living Room', on: true }, makeMeta(harness.threadId))).rejects.toMatchObject({ type: 'RATE_LIMITED' });
  });

  it('list_scenes shows device-specific scenes', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('list_scenes');
    const result = await tool.handler(ctx, { device: 'Living Room' }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Sunset');
    expect(text).toContain('Movie');
  });

  it('create_group + list_groups persists virtual groups', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const createTool = getTool('create_group');
    const createResult = await createTool.handler(
      ctx,
      { name: 'All Lights', devices: ['Living Room Light', 'Bedroom Strip'] },
      makeMeta(harness.threadId),
    );
    const createText = typeof createResult === 'string' ? createResult : createResult.text;
    expect(createText).toContain('Created group');
    expect(createText).toContain('2 devices');

    const listTool = getTool('list_groups');
    const listResult = await listTool.handler(ctx, {}, makeMeta(harness.threadId));
    const listText = typeof listResult === 'string' ? listResult : listResult.text;
    expect(listText).toContain('All Lights');
  });

  it('get_status shows rate limit usage and device count', async () => {
    await seedApiKey(prisma);
    harness = await createTestHarness(goveePlugin);
    const ctx = harness.orchestrator.getContext();

    const setTool = getTool('set_light');
    await setTool.handler(ctx, { device: 'Living Room', on: true }, makeMeta(harness.threadId));

    const statusTool = getTool('get_status');
    const result = await statusTool.handler(ctx, {}, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Devices: 2');
    expect(text).toContain('Daily API usage:');
    expect(text).toContain('/10');
  });
});
