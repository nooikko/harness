import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../commands';

describe('COMMANDS registry', () => {
  it('contains system, agent, and tool commands', () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(7);
  });

  it('every command has required fields with correct types', () => {
    for (const cmd of COMMANDS) {
      expect(typeof cmd.name).toBe('string');
      expect(cmd.name.length).toBeGreaterThan(0);
      expect(typeof cmd.description).toBe('string');
      expect(typeof cmd.args).toBe('string');
      expect(['input', 'agent', 'system', 'tool']).toContain(cmd.category);
    }
  });

  it('includes /current-time as an auto-discovered tool command', () => {
    const cmd = COMMANDS.find((c) => c.name === 'current-time');
    expect(cmd).toBeDefined();
    expect(cmd?.category).toBe('tool');
    expect(cmd?.pluginName).toBe('time');
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

  it('tool commands have pluginName set', () => {
    const toolCmds = COMMANDS.filter((c) => c.category === 'tool');
    expect(toolCmds.length).toBeGreaterThanOrEqual(1);
    for (const cmd of toolCmds) {
      expect(cmd.pluginName).toBeDefined();
      expect(typeof cmd.pluginName).toBe('string');
    }
  });

  it('includes auto-discovered plugin tools', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('delegate');
    expect(names).toContain('checkin');
    expect(names).toContain('schedule-task');
    expect(names).toContain('update-self');
  });

  it('disambiguates tools with the same name across plugins', () => {
    // tasks and cron both expose list-tasks and update-task
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('tasks-list-tasks');
    expect(names).toContain('cron-list-tasks');
    expect(names).toContain('tasks-update-task');
    expect(names).toContain('cron-update-task');
  });

  it('no duplicate command names', () => {
    const names = COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
