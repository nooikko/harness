import { describe, expect, it } from 'vitest';
import { getCronJobDefinitions } from '../cron-job-definitions';

/**
 * Validates a cron expression has the correct structure.
 * Format: minute hour day-of-month month day-of-week
 * Each field can be: number, *, or step (e.g. * /30)
 */
type IsValidCronExpression = (expression: string) => boolean;

const isValidCronExpression: IsValidCronExpression = (expression) => {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return false;
  }

  const patterns = [
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // minute (0-59)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // hour (0-23)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // day of month (1-31)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // month (1-12)
    /^(\*|(\*\/\d+)|(\d+(-\d+)?(,\d+(-\d+)?)*))$/, // day of week (0-7)
  ];

  return parts.every((part, index) => {
    const pattern = patterns[index];
    return pattern?.test(part) ?? false;
  });
};

describe('getCronJobDefinitions', () => {
  const definitions = getCronJobDefinitions();

  it('returns exactly four cron job definitions', () => {
    expect(definitions).toHaveLength(4);
  });

  it('includes all expected cron jobs by name', () => {
    const names = definitions.map((d) => d.name);
    expect(names).toContain('Morning Digest');
    expect(names).toContain('Memory Consolidation');
    expect(names).toContain('Calendar Email Refresh');
    expect(names).toContain('Weekly Review');
  });

  it('has unique names for all definitions', () => {
    const names = definitions.map((d) => d.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('has valid cron expressions for all definitions', () => {
    for (const definition of definitions) {
      expect(isValidCronExpression(definition.schedule), `Invalid cron expression for "${definition.name}": ${definition.schedule}`).toBe(true);
    }
  });

  it('has non-empty prompts for all definitions', () => {
    for (const definition of definitions) {
      expect(definition.prompt.length).toBeGreaterThan(0);
      expect(definition.prompt.trim()).not.toBe('');
    }
  });

  it('has all definitions enabled by default', () => {
    for (const definition of definitions) {
      expect(definition.enabled).toBe(true);
    }
  });

  describe('Morning Digest', () => {
    const morningDigest = definitions.find((d) => d.name === 'Morning Digest');

    it('runs at 7:00 AM MST (14:00 UTC) daily', () => {
      expect(morningDigest?.schedule).toBe('0 14 * * *');
    });

    it('includes instructions about calendar and email', () => {
      expect(morningDigest?.prompt).toContain('calendar');
      expect(morningDigest?.prompt).toContain('email');
    });
  });

  describe('Memory Consolidation', () => {
    const memoryConsolidation = definitions.find((d) => d.name === 'Memory Consolidation');

    it('runs at 1:00 AM MST (8:00 UTC) daily', () => {
      expect(memoryConsolidation?.schedule).toBe('0 8 * * *');
    });

    it('includes instructions about inbox and memory', () => {
      expect(memoryConsolidation?.prompt).toContain('inbox.md');
      expect(memoryConsolidation?.prompt).toContain('memory.md');
    });
  });

  describe('Calendar Email Refresh', () => {
    const calendarRefresh = definitions.find((d) => d.name === 'Calendar Email Refresh');

    it('runs every 30 minutes', () => {
      expect(calendarRefresh?.schedule).toBe('*/30 * * * *');
    });

    it('includes instructions about world-state', () => {
      expect(calendarRefresh?.prompt).toContain('world-state.md');
    });
  });

  describe('Weekly Review', () => {
    const weeklyReview = definitions.find((d) => d.name === 'Weekly Review');

    it('runs Friday 5:00 PM MST (Saturday 00:00 UTC)', () => {
      expect(weeklyReview?.schedule).toBe('0 0 * * 6');
    });

    it('includes instructions about weekly summary', () => {
      expect(weeklyReview?.prompt).toContain('weekly');
      expect(weeklyReview?.prompt).toContain('summary');
    });
  });

  it('returns a new array on each call (not mutable shared state)', () => {
    const first = getCronJobDefinitions();
    const second = getCronJobDefinitions();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
