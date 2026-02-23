import { describe, expect, it } from 'vitest';
import { getPlugins } from '../index';

describe('getPlugins', () => {
  it('returns an array of plugin definitions', () => {
    const plugins = getPlugins();

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('returns plugins with required fields', () => {
    const plugins = getPlugins();

    for (const plugin of plugins) {
      expect(typeof plugin.name).toBe('string');
      expect(plugin.name.length).toBeGreaterThan(0);
      expect(typeof plugin.version).toBe('string');
      expect(typeof plugin.register).toBe('function');
    }
  });

  it('includes the context plugin', () => {
    const plugins = getPlugins();
    const names = plugins.map((p) => p.name);

    expect(names).toContain('context');
  });

  it('includes the discord plugin', () => {
    const plugins = getPlugins();
    const names = plugins.map((p) => p.name);

    expect(names).toContain('discord');
  });

  it('includes the web plugin', () => {
    const plugins = getPlugins();
    const names = plugins.map((p) => p.name);

    expect(names).toContain('web');
  });
});
