// Tests for build-iteration-prompt helper

import { describe, expect, it } from 'vitest';
import { buildIterationPrompt } from '../build-iteration-prompt';

describe('buildIterationPrompt', () => {
  it('returns the original prompt when feedback is undefined', () => {
    const result = buildIterationPrompt('Write tests', undefined);

    expect(result).toBe('Write tests');
  });

  it('returns the original prompt when feedback is empty string', () => {
    const result = buildIterationPrompt('Write tests', '');

    expect(result).toBe('Write tests');
  });

  it('appends feedback to the prompt', () => {
    const result = buildIterationPrompt('Write tests', 'Missing edge cases');

    expect(result).toContain('Write tests');
    expect(result).toContain('Previous attempt was rejected');
    expect(result).toContain('Missing edge cases');
  });

  it('separates original prompt and feedback with a divider', () => {
    const result = buildIterationPrompt('Build feature', 'Needs more tests');

    expect(result).toContain('---');
  });

  it('preserves the original prompt at the beginning', () => {
    const result = buildIterationPrompt('Original prompt here', 'Some feedback');

    expect(result.startsWith('Original prompt here')).toBe(true);
  });

  it('handles multi-line feedback', () => {
    const feedback = 'Issue 1: missing tests\nIssue 2: no error handling';
    const result = buildIterationPrompt('Do work', feedback);

    expect(result).toContain('Issue 1: missing tests');
    expect(result).toContain('Issue 2: no error handling');
  });
});
