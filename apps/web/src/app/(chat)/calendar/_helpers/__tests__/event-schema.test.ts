import { describe, expect, it } from 'vitest';
import { eventSchema } from '../event-schema';

describe('eventSchema', () => {
  const validData = {
    title: 'Team Meeting',
    description: 'Weekly sync',
    startDate: new Date(2026, 2, 18, 10, 0),
    endDate: new Date(2026, 2, 18, 11, 0),
    color: 'blue' as const,
  };

  it('accepts valid event data', () => {
    const result = eventSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = eventSchema.safeParse({ ...validData, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const { title: _, ...noTitle } = validData;
    const result = eventSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = eventSchema.safeParse({ ...validData, description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid color', () => {
    const result = eventSchema.safeParse({ ...validData, color: 'magenta' });
    expect(result.success).toBe(false);
  });

  it.each(['blue', 'green', 'red', 'yellow', 'purple', 'orange'] as const)('accepts color %s', (color) => {
    const result = eventSchema.safeParse({ ...validData, color });
    expect(result.success).toBe(true);
  });

  it('rejects non-Date for startDate', () => {
    const result = eventSchema.safeParse({ ...validData, startDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});
