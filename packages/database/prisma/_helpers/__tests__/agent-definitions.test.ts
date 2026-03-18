import { describe, expect, it } from 'vitest';
import { getAgentDefinitions } from '../agent-definitions';

describe('getAgentDefinitions', () => {
  const definitions = getAgentDefinitions();

  it('returns 8 agent definitions', () => {
    expect(definitions).toHaveLength(8);
  });

  it('includes system and default agents', () => {
    const slugs = definitions.map((d) => d.slug);
    expect(slugs).toContain('system');
    expect(slugs).toContain('default');
  });

  it('has unique slugs', () => {
    const slugs = definitions.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all definitions have required fields', () => {
    for (const def of definitions) {
      expect(def.slug).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.soul).toBeTruthy();
      expect(def.identity).toBeTruthy();
      expect(def.config).toBeDefined();
      expect(typeof def.config.bootstrapped).toBe('boolean');
      expect(typeof def.config.memoryEnabled).toBe('boolean');
      expect(typeof def.config.reflectionEnabled).toBe('boolean');
    }
  });

  it('system agent has memory disabled', () => {
    const system = definitions.find((d) => d.slug === 'system');
    expect(system?.config.memoryEnabled).toBe(false);
  });

  it('returns a new array on each call', () => {
    const first = getAgentDefinitions();
    const second = getAgentDefinitions();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
