import { describe, expect, it } from 'vitest';
import { getProjectDefinitions } from '../project-definitions';

describe('getProjectDefinitions', () => {
  const definitions = getProjectDefinitions();

  it('returns 3 project definitions', () => {
    expect(definitions).toHaveLength(3);
  });

  it('includes General project with stable seed ID', () => {
    const general = definitions.find((d) => d.name === 'General');
    expect(general?.id).toBe('seed_default_project_001');
  });

  it('has unique IDs', () => {
    const ids = definitions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all definitions have required fields', () => {
    for (const def of definitions) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });

  it('returns a new array on each call', () => {
    const first = getProjectDefinitions();
    const second = getProjectDefinitions();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
