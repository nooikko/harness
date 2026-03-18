import { describe, expect, it } from 'vitest';
import { formatStorytellingInstructions } from '../format-storytelling-instructions';

describe('formatStorytellingInstructions', () => {
  it('returns a non-empty string', () => {
    const result = formatStorytellingInstructions();
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains dialogue convention', () => {
    const result = formatStorytellingInstructions();
    expect(result).toContain('**CHARACTER NAME**');
    expect(result).toContain('Dialogue');
  });

  it('contains action/description convention', () => {
    const result = formatStorytellingInstructions();
    expect(result).toContain('italics');
    expect(result).toContain('Actions');
  });

  it('contains thought convention', () => {
    const result = formatStorytellingInstructions();
    expect(result).toContain('blockquote');
    expect(result).toContain('Thoughts');
  });

  it('contains scene break convention', () => {
    const result = formatStorytellingInstructions();
    expect(result).toContain('---');
    expect(result).toContain('Scene Break');
  });

  it('contains example markup', () => {
    const result = formatStorytellingInstructions();
    expect(result).toContain('**ELENA**');
  });
});
