import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { filterDisabledPlugins } from '../filter-disabled-plugins';

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

type MockDb = {
  pluginConfig: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const makeDb = (disabledNames: string[] = []): MockDb => ({
  pluginConfig: {
    findMany: vi.fn().mockResolvedValue(disabledNames.map((name) => ({ pluginName: name }))),
  },
});

const makePlugin = (name: string): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
});

describe('filterDisabledPlugins', () => {
  describe('default behavior (all enabled)', () => {
    it('returns all plugins when no plugins are disabled in database', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const db = makeDb();

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(result).toEqual(plugins);
    });

    it('returns the same array reference when no plugins are disabled', async () => {
      const plugins = [makePlugin('context')];
      const db = makeDb();

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(result).toBe(plugins);
    });

    it('returns empty array when given empty plugins and no disabled configs', async () => {
      const db = makeDb();

      const result = await filterDisabledPlugins([], db as unknown as PrismaClient, makeLogger());

      expect(result).toEqual([]);
    });
  });

  describe('filtering disabled plugins', () => {
    it('removes a single disabled plugin', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const db = makeDb(['discord']);

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(['context', 'web']);
    });

    it('removes multiple disabled plugins', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const db = makeDb(['discord', 'web']);

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('context');
    });

    it('removes all plugins when all are disabled', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const db = makeDb(['context', 'discord']);

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(result).toHaveLength(0);
    });
  });

  describe('database query', () => {
    it('queries pluginConfig for disabled plugins', async () => {
      const plugins = [makePlugin('context')];
      const db = makeDb();

      await filterDisabledPlugins(plugins, db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.findMany).toHaveBeenCalledWith({
        where: { enabled: false },
      });
    });
  });

  describe('logging', () => {
    it('logs an info message for each disabled plugin', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const db = makeDb(['discord', 'web']);
      const logger = makeLogger();

      await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: discord');
      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: web');
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('does not log when no plugins are disabled', async () => {
      const plugins = [makePlugin('context')];
      const db = makeDb();
      const logger = makeLogger();

      await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('unknown plugin names', () => {
    it('warns when a disabled plugin name does not exist in the registry', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const db = makeDb(['nonexistent']);
      const logger = makeLogger();

      await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "nonexistent" not found in registry \u2014 ignoring');
    });

    it('still filters valid disabled plugins when unknown names are also present', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const db = makeDb(['discord', 'nonexistent']);
      const logger = makeLogger();

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(['context', 'web']);
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "nonexistent" not found in registry \u2014 ignoring');
      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: discord');
    });

    it('warns for each unknown plugin name', async () => {
      const plugins = [makePlugin('context')];
      const db = makeDb(['unknown-a', 'unknown-b']);
      const logger = makeLogger();

      await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "unknown-a" not found in registry \u2014 ignoring');
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "unknown-b" not found in registry \u2014 ignoring');
    });

    it('handles gracefully when all disabled plugin names are unknown', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const db = makeDb(['fake-plugin']);
      const logger = makeLogger();

      const result = await filterDisabledPlugins(plugins, db as unknown as PrismaClient, logger);

      expect(result).toHaveLength(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
