import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/sync-plugin-configs', () => ({
  syncPluginConfigs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_helpers/filter-disabled-plugins', () => ({
  filterDisabledPlugins: vi.fn().mockImplementation((plugins: PluginDefinition[]) => Promise.resolve(plugins)),
}));

import { filterDisabledPlugins } from '../_helpers/filter-disabled-plugins';
import { syncPluginConfigs } from '../_helpers/sync-plugin-configs';
import { getPlugins } from '../index';

const mockSyncPluginConfigs = vi.mocked(syncPluginConfigs);
const mockFilterDisabledPlugins = vi.mocked(filterDisabledPlugins);

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeDb = (): PrismaClient => ({}) as unknown as PrismaClient;

describe('getPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilterDisabledPlugins.mockImplementation((plugins: PluginDefinition[]) => Promise.resolve(plugins));
  });

  it('returns an array of plugin definitions', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('returns plugins with required fields', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());

    for (const plugin of plugins) {
      expect(typeof plugin.name).toBe('string');
      expect(plugin.name.length).toBeGreaterThan(0);
      expect(typeof plugin.version).toBe('string');
      expect(typeof plugin.register).toBe('function');
    }
  });

  it('includes the context plugin', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('context');
  });

  it('includes the discord plugin', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('discord');
  });

  it('includes the web plugin', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('web');
  });

  it('includes the metrics plugin', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('metrics');
  });

  it('includes the time plugin', async () => {
    const plugins = await getPlugins(makeDb(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('time');
  });

  it('calls syncPluginConfigs before filterDisabledPlugins', async () => {
    const db = makeDb();
    const logger = makeLogger();

    await getPlugins(db, logger);

    expect(mockSyncPluginConfigs).toHaveBeenCalledTimes(1);
    expect(mockFilterDisabledPlugins).toHaveBeenCalledTimes(1);

    const syncOrder = mockSyncPluginConfigs.mock.invocationCallOrder[0] ?? 0;
    const filterOrder = mockFilterDisabledPlugins.mock.invocationCallOrder[0] ?? 0;
    expect(syncOrder).toBeLessThan(filterOrder);
  });

  it('passes db and logger to syncPluginConfigs', async () => {
    const db = makeDb();
    const logger = makeLogger();

    await getPlugins(db, logger);

    expect(mockSyncPluginConfigs).toHaveBeenCalledWith(expect.any(Array), db, logger);
  });

  it('passes db and logger to filterDisabledPlugins', async () => {
    const db = makeDb();
    const logger = makeLogger();

    await getPlugins(db, logger);

    expect(mockFilterDisabledPlugins).toHaveBeenCalledWith(expect.any(Array), db, logger);
  });
});
