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
  it('returns undefined for non-storytelling threads', () => {
    expect(computeDisallowedTools('general', ALL_TOOLS)).toBeUndefined();
    expect(computeDisallowedTools('primary', ALL_TOOLS)).toBeUndefined();
    expect(computeDisallowedTools('cron', ALL_TOOLS)).toBeUndefined();
    expect(computeDisallowedTools('task', ALL_TOOLS)).toBeUndefined();
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

  it('returns undefined when all tools are allowed', () => {
    const onlyAllowed = ['storytelling__update_character', 'time__current_time', 'identity__update_self'];
    expect(computeDisallowedTools('storytelling', onlyAllowed)).toBeUndefined();
  });

  it('returns undefined for empty tool list', () => {
    expect(computeDisallowedTools('storytelling', [])).toBeUndefined();
  });
});
