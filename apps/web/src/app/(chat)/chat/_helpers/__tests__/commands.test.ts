import { describe, expect, it } from 'vitest';
import { COMMANDS } from '../commands';

describe('COMMANDS registry', () => {
  it('contains system, agent, and tool commands', () => {
    // 3 system + 1 agent (re-delegate) + 1 tool (create-plan) = 5 minimum
    expect(COMMANDS.length).toBeGreaterThanOrEqual(5);
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

  it('includes all three system commands', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('model');
    expect(names).toContain('new');
    expect(names).toContain('clear');
  });

  it("system commands have category 'system'", () => {
    const systemCmds = COMMANDS.filter((c) => c.category === 'system');
    expect(systemCmds.length).toBe(3);
  });

  it('includes human-facing tool commands', () => {
    const toolCmds = COMMANDS.filter((c) => c.category === 'tool');
    expect(toolCmds.length).toBe(2);
    const names = toolCmds.map((c) => c.name);
    expect(names).toContain('create-plan');
    expect(names).toContain('send-dm');
  });

  it('excludes all agent-audience tools from the command list', () => {
    const names = COMMANDS.map((c) => c.name);
    // delegation
    expect(names).not.toContain('delegate');
    expect(names).not.toContain('checkin');
    // identity
    expect(names).not.toContain('update-self');
    // project
    expect(names).not.toContain('get-project-memory');
    expect(names).not.toContain('set-project-memory');
    // music
    expect(names).not.toContain('play');
    expect(names).not.toContain('pause');
    // govee
    expect(names).not.toContain('set-light');
    expect(names).not.toContain('toggle-light');
    // cron
    expect(names).not.toContain('schedule-task');
    // outlook
    expect(names).not.toContain('send-email');
    // calendar
    expect(names).not.toContain('list-events');
    // playwright
    expect(names).not.toContain('navigate');
    // ssh
    expect(names).not.toContain('exec');
    // tasks
    expect(names).not.toContain('add-task');
    // time
    expect(names).not.toContain('current-time');
    // logs
    expect(names).not.toContain('query');
  });

  it('no duplicate command names', () => {
    const names = COMMANDS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
