import type { Logger } from '@harness/logger';
import type { OrchestratorConfig, PluginDefinition } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { filterDisabledPlugins } from '../filter-disabled-plugins';

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeConfig = (overrides?: Partial<OrchestratorConfig>): OrchestratorConfig => ({
  databaseUrl: 'postgres://test',
  timezone: 'UTC',
  maxConcurrentAgents: 3,
  claudeModel: 'sonnet',
  claudeTimeout: 300000,
  discordToken: undefined,
  discordChannelId: undefined,
  port: 3001,
  logLevel: 'info' as const,
  disabledPlugins: [],
  ...overrides,
});

const makePlugin = (name: string): PluginDefinition => ({
  name,
  version: '1.0.0',
  register: vi.fn().mockResolvedValue({}),
});

describe('filterDisabledPlugins', () => {
  describe('default behavior (all enabled)', () => {
    it('returns all plugins when disabledPlugins is empty', () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const config = makeConfig({ disabledPlugins: [] });

      const result = filterDisabledPlugins(plugins, config, makeLogger());

      expect(result).toEqual(plugins);
    });

    it('returns the same array reference when no plugins are disabled', () => {
      const plugins = [makePlugin('context')];
      const config = makeConfig({ disabledPlugins: [] });

      const result = filterDisabledPlugins(plugins, config, makeLogger());

      expect(result).toBe(plugins);
    });

    it('returns empty array when given empty plugins and empty disabledPlugins', () => {
      const result = filterDisabledPlugins([], makeConfig(), makeLogger());

      expect(result).toEqual([]);
    });
  });

  describe('filtering disabled plugins', () => {
    it('removes a single disabled plugin', () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const config = makeConfig({ disabledPlugins: ['discord'] });

      const result = filterDisabledPlugins(plugins, config, makeLogger());

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(['context', 'web']);
    });

    it('removes multiple disabled plugins', () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const config = makeConfig({ disabledPlugins: ['discord', 'web'] });

      const result = filterDisabledPlugins(plugins, config, makeLogger());

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('context');
    });

    it('removes all plugins when all are disabled', () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const config = makeConfig({ disabledPlugins: ['context', 'discord'] });

      const result = filterDisabledPlugins(plugins, config, makeLogger());

      expect(result).toHaveLength(0);
    });
  });

  describe('logging', () => {
    it('logs an info message for each disabled plugin', () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const config = makeConfig({ disabledPlugins: ['discord', 'web'] });
      const logger = makeLogger();

      filterDisabledPlugins(plugins, config, logger);

      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: discord');
      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: web');
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('does not log when no plugins are disabled', () => {
      const plugins = [makePlugin('context')];
      const config = makeConfig({ disabledPlugins: [] });
      const logger = makeLogger();

      filterDisabledPlugins(plugins, config, logger);

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('unknown plugin names', () => {
    it('warns when a disabled plugin name does not exist in the registry', () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const config = makeConfig({ disabledPlugins: ['nonexistent'] });
      const logger = makeLogger();

      filterDisabledPlugins(plugins, config, logger);

      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "nonexistent" not found in registry \u2014 ignoring');
    });

    it('still filters valid disabled plugins when unknown names are also present', () => {
      const plugins = [makePlugin('context'), makePlugin('discord'), makePlugin('web')];
      const config = makeConfig({ disabledPlugins: ['discord', 'nonexistent'] });
      const logger = makeLogger();

      const result = filterDisabledPlugins(plugins, config, logger);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.name)).toEqual(['context', 'web']);
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "nonexistent" not found in registry \u2014 ignoring');
      expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: discord');
    });

    it('warns for each unknown plugin name', () => {
      const plugins = [makePlugin('context')];
      const config = makeConfig({ disabledPlugins: ['unknown-a', 'unknown-b'] });
      const logger = makeLogger();

      filterDisabledPlugins(plugins, config, logger);

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "unknown-a" not found in registry \u2014 ignoring');
      expect(logger.warn).toHaveBeenCalledWith('Disabled plugin "unknown-b" not found in registry \u2014 ignoring');
    });

    it('handles gracefully when all disabled plugin names are unknown', () => {
      const plugins = [makePlugin('context'), makePlugin('discord')];
      const config = makeConfig({ disabledPlugins: ['fake-plugin'] });
      const logger = makeLogger();

      const result = filterDisabledPlugins(plugins, config, logger);

      expect(result).toHaveLength(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
