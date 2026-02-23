import type { Logger } from '@harness/logger';
import type { PluginDefinition } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { syncPluginConfigs } from '../sync-plugin-configs';

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makePlugin = (name: string): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
});

type MockDb = {
  pluginConfig: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

type ExistingConfig = {
  id: string;
  pluginName: string;
  enabled: boolean;
};

const makeDb = (existingConfigs: ExistingConfig[] = []): MockDb => ({
  pluginConfig: {
    findMany: vi.fn().mockResolvedValue(existingConfigs),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
});

describe('syncPluginConfigs', () => {
  describe('initial sync (empty database)', () => {
    it('creates config records for all plugins when database is empty', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const db = makeDb();
      const logger = makeLogger();

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, logger);

      expect(db.pluginConfig.create).toHaveBeenCalledTimes(2);
      expect(db.pluginConfig.create).toHaveBeenCalledWith({
        data: { pluginName: 'context', enabled: true },
      });
      expect(db.pluginConfig.create).toHaveBeenCalledWith({
        data: { pluginName: 'discord', enabled: true },
      });
    });

    it('logs when adding new plugin configs', async () => {
      const plugins = [makePlugin('context')];
      const db = makeDb();
      const logger = makeLogger();

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, logger);

      expect(logger.info).toHaveBeenCalledWith('Added plugin config for new plugin: context');
    });
  });

  describe('subsequent sync (preserves existing)', () => {
    it('does not create records for plugins that already exist in database', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
        {
          id: 'cfg-2',
          pluginName: 'discord',
          enabled: false,
        },
      ];
      const db = makeDb(existingConfigs);
      const logger = makeLogger();

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, logger);

      expect(db.pluginConfig.create).not.toHaveBeenCalled();
    });

    it('preserves existing enabled states', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
        {
          id: 'cfg-2',
          pluginName: 'discord',
          enabled: false,
        },
      ];
      const db = makeDb(existingConfigs);

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, makeLogger());

      // No creates or deletes — existing records are left intact
      expect(db.pluginConfig.create).not.toHaveBeenCalled();
      expect(db.pluginConfig.delete).not.toHaveBeenCalled();
    });

    it('creates only new plugins when some already exist', async () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
      ];
      const db = makeDb(existingConfigs);

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.create).toHaveBeenCalledTimes(2);
      expect(db.pluginConfig.create).toHaveBeenCalledWith({
        data: { pluginName: 'discord', enabled: true },
      });
      expect(db.pluginConfig.create).toHaveBeenCalledWith({
        data: { pluginName: 'web', enabled: true },
      });
    });
  });

  describe('stale plugin removal', () => {
    it('removes configs for plugins no longer in the registry', async () => {
      const plugins = [makePlugin('context')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
        {
          id: 'cfg-2',
          pluginName: 'removed-plugin',
          enabled: true,
        },
      ];
      const db = makeDb(existingConfigs);
      const logger = makeLogger();

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, logger);

      expect(db.pluginConfig.delete).toHaveBeenCalledTimes(1);
      expect(db.pluginConfig.delete).toHaveBeenCalledWith({
        where: { id: 'cfg-2' },
      });
    });

    it('logs when removing stale configs', async () => {
      const plugins = [makePlugin('context')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
        {
          id: 'cfg-2',
          pluginName: 'old-plugin',
          enabled: false,
        },
      ];
      const db = makeDb(existingConfigs);
      const logger = makeLogger();

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, logger);

      expect(logger.info).toHaveBeenCalledWith('Removed stale plugin config: old-plugin');
    });

    it('removes multiple stale configs', async () => {
      const plugins = [makePlugin('context')];
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'context',
          enabled: true,
        },
        {
          id: 'cfg-2',
          pluginName: 'stale-a',
          enabled: true,
        },
        {
          id: 'cfg-3',
          pluginName: 'stale-b',
          enabled: false,
        },
      ];
      const db = makeDb(existingConfigs);

      await syncPluginConfigs(plugins, db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty plugin list', async () => {
      const existingConfigs: ExistingConfig[] = [
        {
          id: 'cfg-1',
          pluginName: 'old-plugin',
          enabled: true,
        },
      ];
      const db = makeDb(existingConfigs);

      await syncPluginConfigs([], db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.create).not.toHaveBeenCalled();
      expect(db.pluginConfig.delete).toHaveBeenCalledTimes(1);
    });

    it('handles empty database and empty plugin list', async () => {
      const db = makeDb();

      await syncPluginConfigs([], db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.create).not.toHaveBeenCalled();
      expect(db.pluginConfig.delete).not.toHaveBeenCalled();
    });

    it('queries the database for existing configs', async () => {
      const db = makeDb();

      await syncPluginConfigs([], db as unknown as PrismaClient, makeLogger());

      expect(db.pluginConfig.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
