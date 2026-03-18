import { describe, expect, it } from 'vitest';
import { plugin } from '../index';

describe('plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('calendar');
    expect(plugin.version).toBe('1.0.0');
  });

  it('defines 6 tools', () => {
    expect(plugin.tools).toHaveLength(6);
  });

  it('has expected tool names', () => {
    const toolNames = plugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual(['create_event', 'update_event', 'delete_event', 'list_events', 'get_event', 'sync_now']);
  });

  it('register returns onSettingsChange hook', async () => {
    const ctx = { logger: { warn: () => {} } } as unknown as Parameters<typeof plugin.register>[0];
    const hooks = await plugin.register(ctx);
    expect(hooks.onSettingsChange).toBeDefined();
  });
});
