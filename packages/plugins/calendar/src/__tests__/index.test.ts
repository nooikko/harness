import { describe, expect, it } from 'vitest';
import { plugin } from '../index';

describe('plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('calendar');
    expect(plugin.version).toBe('1.0.0');
  });

  it('defines 7 tools', () => {
    expect(plugin.tools).toHaveLength(7);
  });

  it('has expected tool names', () => {
    const toolNames = plugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual(['list_events', 'get_event', 'create_event', 'update_event', 'delete_event', 'find_free_time', 'list_calendars']);
  });

  it('register returns empty hooks', async () => {
    const hooks = await plugin.register({} as Parameters<typeof plugin.register>[0]);
    expect(hooks).toEqual({});
  });
});
