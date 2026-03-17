import { describe, expect, it } from 'vitest';
import { validateGraphId } from '../validate-graph-id';

describe('validateGraphId', () => {
  it('accepts valid Graph IDs', () => {
    expect(validateGraphId('AAMkAGI2', 'id')).toBe('AAMkAGI2');
    expect(validateGraphId('abc123+/=_-', 'id')).toBe('abc123+/=_-');
  });

  it('rejects empty strings', () => {
    expect(() => validateGraphId('', 'messageId')).toThrow('Invalid messageId');
  });

  it('rejects path traversal', () => {
    expect(() => validateGraphId('abc..def', 'eventId')).toThrow('Invalid eventId');
  });

  it('rejects special characters', () => {
    expect(() => validateGraphId('abc/../../etc', 'id')).toThrow('Invalid id');
    expect(() => validateGraphId('abc<script>', 'id')).toThrow('Invalid id');
  });
});
