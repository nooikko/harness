import { describe, expect, it } from 'vitest';
import { parsePluginSource } from '../parse-plugin-source';

describe('parsePluginSource', () => {
  it('returns builtin for core tool names', () => {
    expect(parsePluginSource('Read')).toBe('builtin');
    expect(parsePluginSource('Bash')).toBe('builtin');
    expect(parsePluginSource('Write')).toBe('builtin');
  });

  it('extracts plugin name from plugin__method format', () => {
    expect(parsePluginSource('delegationPlugin__delegate')).toBe('delegation');
    expect(parsePluginSource('timePlugin__getTime')).toBe('time');
    expect(parsePluginSource('discordPlugin__sendMessage')).toBe('discord');
  });

  it('returns builtin for undefined', () => {
    expect(parsePluginSource(undefined)).toBe('builtin');
  });

  it('returns builtin for unrecognized format', () => {
    expect(parsePluginSource('someRandomTool')).toBe('builtin');
  });
});
