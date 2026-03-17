import { describe, expect, it } from 'vitest';
import { plugin } from '../index';

describe('plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('outlook');
    expect(plugin.version).toBe('1.0.0');
  });

  it('defines 8 tools', () => {
    expect(plugin.tools).toHaveLength(8);
  });

  it('has expected tool names', () => {
    const toolNames = plugin.tools!.map((t) => t.name);
    expect(toolNames).toEqual([
      'search_emails',
      'read_email',
      'list_recent',
      'send_email',
      'reply_email',
      'move_email',
      'list_folders',
      'find_unsubscribe_links',
    ]);
  });

  it('register returns empty hooks', async () => {
    const hooks = await plugin.register({} as never);
    expect(hooks).toEqual({});
  });
});
