import { describe, expect, it } from 'vitest';
import { parsePluginSource } from '../parse-plugin-source';

describe('parsePluginSource', () => {
  it('returns builtin for core tool names', () => {
    expect(parsePluginSource('Read')).toBe('builtin');
    expect(parsePluginSource('Bash')).toBe('builtin');
    expect(parsePluginSource('Write')).toBe('builtin');
  });

  it('extracts plugin name from pluginName__method format', () => {
    // Real tool server format is `${p.name}__${t.name}` — no "Plugin" suffix
    expect(parsePluginSource('delegation__delegate')).toBe('delegation');
    expect(parsePluginSource('time__current_time')).toBe('time');
    expect(parsePluginSource('discord__send-message')).toBe('discord');
  });

  it('returns builtin for undefined', () => {
    expect(parsePluginSource(undefined)).toBe('builtin');
  });

  it('returns builtin for unrecognized format', () => {
    expect(parsePluginSource('someRandomTool')).toBe('builtin');
  });
});
