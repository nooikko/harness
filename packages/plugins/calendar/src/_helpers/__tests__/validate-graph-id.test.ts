import { describe, expect, it } from 'vitest';
import { validateGraphId } from '../validate-graph-id';

describe('validateGraphId', () => {
  it('accepts valid Graph IDs', () => {
    expect(validateGraphId('AAMkAGI2', 'id')).toBe('AAMkAGI2');
  });

  it('rejects empty strings', () => {
    expect(() => validateGraphId('', 'eventId')).toThrow('Invalid eventId');
  });

  it('rejects path traversal', () => {
    expect(() => validateGraphId('abc..def', 'eventId')).toThrow('Invalid eventId');
  });
});
