import { describe, expect, it } from 'vitest';
import { computeDisallowedTools } from '../compute-disallowed-tools';

const ALL_TOOLS = [
  'identity__update_self',
  'delegation__delegate',
  'delegation__checkin',
  'cron__schedule_task',
  'time__current_time',
  'tasks__add_task',
  'tasks__list_tasks',
  'storytelling__update_character',
  'storytelling__record_moment',
  'storytelling__advance_time',
  'storytelling__add_location',
  'storytelling__character_knowledge',
  'storytelling__get_character',
  'music__play',
  'calendar__list_events',
];

describe('computeDisallowedTools', () => {
  it('disallows storytelling tools for non-storytelling threads', () => {
    const result = computeDisallowedTools('general', ALL_TOOLS);
    expect(result).toBeDefined();
    expect(result).toContain('storytelling__update_character');
    expect(result).toContain('storytelling__record_moment');
    expect(result).toContain('storytelling__advance_time');
    expect(result).toContain('storytelling__add_location');
    expect(result).toContain('storytelling__character_knowledge');
    expect(result).toContain('storytelling__get_character');
  });

  it('allows non-storytelling tools for non-storytelling threads', () => {
    const result = computeDisallowedTools('general', ALL_TOOLS) ?? [];
    expect(result).not.toContain('identity__update_self');
    expect(result).not.toContain('delegation__delegate');
    expect(result).not.toContain('delegation__checkin');
    expect(result).not.toContain('cron__schedule_task');
    expect(result).not.toContain('time__current_time');
    expect(result).not.toContain('tasks__add_task');
    expect(result).not.toContain('tasks__list_tasks');
    expect(result).not.toContain('music__play');
    expect(result).not.toContain('calendar__list_events');
  });

  it('disallows storytelling tools for all non-storytelling thread kinds', () => {
    for (const kind of ['primary', 'cron', 'task', 'general']) {
      const result = computeDisallowedTools(kind, ALL_TOOLS);
      expect(result).toBeDefined();
      expect(result).toContain('storytelling__update_character');
    }
  });

  it('returns undefined for non-storytelling threads with no storytelling tools', () => {
    const noStoryTools = ['delegation__delegate', 'time__current_time', 'identity__update_self'];
    expect(computeDisallowedTools('general', noStoryTools)).toBeUndefined();
  });

  it('disallows non-storytelling/time/identity tools for storytelling threads', () => {
    const result = computeDisallowedTools('storytelling', ALL_TOOLS);
    expect(result).toBeDefined();
    expect(result).toContain('delegation__delegate');
    expect(result).toContain('delegation__checkin');
    expect(result).toContain('cron__schedule_task');
    expect(result).toContain('tasks__add_task');
    expect(result).toContain('tasks__list_tasks');
    expect(result).toContain('music__play');
    expect(result).toContain('calendar__list_events');
  });

  it('allows storytelling, time, and identity tools for storytelling threads', () => {
    const result = computeDisallowedTools('storytelling', ALL_TOOLS)!;
    expect(result).not.toContain('storytelling__update_character');
    expect(result).not.toContain('storytelling__record_moment');
    expect(result).not.toContain('storytelling__advance_time');
    expect(result).not.toContain('storytelling__add_location');
    expect(result).not.toContain('storytelling__character_knowledge');
    expect(result).not.toContain('storytelling__get_character');
    expect(result).not.toContain('time__current_time');
    expect(result).not.toContain('identity__update_self');
  });

  it('returns undefined when all tools are allowed for storytelling thread', () => {
    const onlyAllowed = ['storytelling__update_character', 'time__current_time', 'identity__update_self'];
    expect(computeDisallowedTools('storytelling', onlyAllowed)).toBeUndefined();
  });

  it('returns undefined for empty tool list', () => {
    expect(computeDisallowedTools('storytelling', [])).toBeUndefined();
    expect(computeDisallowedTools('general', [])).toBeUndefined();
  });
});
