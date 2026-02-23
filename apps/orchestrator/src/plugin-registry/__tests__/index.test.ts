import type { Logger } from '@harness/logger';
import type { OrchestratorConfig } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { getPlugins } from '../index';

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

describe('getPlugins', () => {
  it('returns an array of plugin definitions when none are disabled', () => {
    const plugins = getPlugins(makeConfig(), makeLogger());

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('returns plugins with required fields', () => {
    const plugins = getPlugins(makeConfig(), makeLogger());

    for (const plugin of plugins) {
      expect(typeof plugin.name).toBe('string');
      expect(plugin.name.length).toBeGreaterThan(0);
      expect(typeof plugin.version).toBe('string');
      expect(typeof plugin.register).toBe('function');
    }
  });

  it('includes the context plugin', () => {
    const plugins = getPlugins(makeConfig(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('context');
  });

  it('includes the discord plugin', () => {
    const plugins = getPlugins(makeConfig(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('discord');
  });

  it('includes the web plugin', () => {
    const plugins = getPlugins(makeConfig(), makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).toContain('web');
  });

  it('excludes plugins listed in disabledPlugins', () => {
    const config = makeConfig({ disabledPlugins: ['discord'] });
    const plugins = getPlugins(config, makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).not.toContain('discord');
    expect(names).toContain('context');
    expect(names).toContain('web');
  });

  it('excludes multiple disabled plugins', () => {
    const config = makeConfig({ disabledPlugins: ['discord', 'web'] });
    const plugins = getPlugins(config, makeLogger());
    const names = plugins.map((p) => p.name);

    expect(names).not.toContain('discord');
    expect(names).not.toContain('web');
    expect(names).toContain('context');
  });

  it('logs when a plugin is disabled', () => {
    const config = makeConfig({ disabledPlugins: ['discord'] });
    const logger = makeLogger();

    getPlugins(config, logger);

    expect(logger.info).toHaveBeenCalledWith('Plugin disabled by config: discord');
  });
});
