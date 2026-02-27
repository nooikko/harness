import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../commands';

describe('COMMANDS registry', () => {
  it('contains at least 7 commands', () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(7);
  });

  it('every command has required fields with correct types', () => {
    for (const cmd of COMMANDS) {
      expect(typeof cmd.name).toBe('string');
      expect(cmd.name.length).toBeGreaterThan(0);
      expect(typeof cmd.description).toBe('string');
      expect(typeof cmd.args).toBe('string');
      expect(['input', 'agent', 'system']).toContain(cmd.category);
    }
  });

  it('includes /current-time as an input command', () => {
    const cmd = COMMANDS.find((c) => c.name === 'current-time');
    expect(cmd).toBeDefined();
    expect(cmd?.category).toBe('input');
  });

  it('includes all three system commands', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('model');
    expect(names).toContain('new');
    expect(names).toContain('clear');
  });

  it("system commands have category 'system'", () => {
    const systemCmds = COMMANDS.filter((c) => c.category === 'system');
    expect(systemCmds.length).toBeGreaterThanOrEqual(3);
  });

  it('no duplicate command names', () => {
    const names = COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
