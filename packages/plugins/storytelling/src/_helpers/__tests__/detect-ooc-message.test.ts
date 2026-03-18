import { describe, expect, it } from 'vitest';
import { detectOocMessage } from '../detect-ooc-message';

describe('detectOocMessage', () => {
  it('detects // prefix with space as OOC', () => {
    const result = detectOocMessage('// change the setting to nighttime');
    expect(result.isOoc).toBe(true);
    expect(result.content).toBe('change the setting to nighttime');
  });

  it('detects // prefix without space as OOC', () => {
    const result = detectOocMessage('//make her angrier');
    expect(result.isOoc).toBe(true);
    expect(result.content).toBe('make her angrier');
  });

  it('returns isOoc=false for normal messages', () => {
    const result = detectOocMessage('The knight drew his sword.');
    expect(result.isOoc).toBe(false);
    expect(result.content).toBe('The knight drew his sword.');
  });

  it('returns isOoc=false for messages containing // mid-text', () => {
    const result = detectOocMessage('She said something // interesting');
    expect(result.isOoc).toBe(false);
    expect(result.content).toBe('She said something // interesting');
  });

  it('handles empty string after //', () => {
    const result = detectOocMessage('//');
    expect(result.isOoc).toBe(true);
    expect(result.content).toBe('');
  });

  it('trims whitespace from cleaned content', () => {
    const result = detectOocMessage('//   lots of spaces   ');
    expect(result.isOoc).toBe(true);
    expect(result.content).toBe('lots of spaces');
  });

  it('handles leading whitespace before //', () => {
    const result = detectOocMessage('   // indented direction');
    expect(result.isOoc).toBe(true);
    expect(result.content).toBe('indented direction');
  });

  it('returns isOoc=false for empty string', () => {
    const result = detectOocMessage('');
    expect(result.isOoc).toBe(false);
    expect(result.content).toBe('');
  });
});
