import { describe, expect, it } from 'vitest';
import { parseFromField } from '../parse-from-field';

describe('parseFromField', () => {
  it('parses standard name <email> format', () => {
    const result = parseFromField('Alice <alice@example.com>');
    expect(result).toEqual({ name: 'Alice', email: 'alice@example.com' });
  });

  it('returns raw string as both name and email when no angle brackets', () => {
    const result = parseFromField('alice@example.com');
    expect(result).toEqual({
      name: 'alice@example.com',
      email: 'alice@example.com',
    });
  });

  it('handles empty string', () => {
    const result = parseFromField('');
    expect(result).toEqual({ name: '', email: '' });
  });

  it('handles name with special characters', () => {
    const result = parseFromField("O'Brien <ob@test.com>");
    expect(result).toEqual({ name: "O'Brien", email: 'ob@test.com' });
  });

  it('extracts first email when multiple angle bracket pairs exist', () => {
    const result = parseFromField('Alice <a@b.com> <c@d.com>');
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com' });
  });

  it('returns empty name when only angle-bracketed email is provided', () => {
    const result = parseFromField('<alice@example.com>');
    expect(result).toEqual({ name: '', email: 'alice@example.com' });
  });
});
