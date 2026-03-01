import { describe, expect, it } from 'vitest';
import { parseVerdict } from '../parse-verdict';

describe('parseVerdict', () => {
  it('returns pass verdict for VERDICT: PASS', () => {
    const response = 'Q1. yes\nQ2. yes\nQ3. yes\nQ4. no\n\nVERDICT: PASS';
    const { verdict, feedback } = parseVerdict(response);
    expect(verdict).toBe('pass');
    expect(feedback).toBe('');
  });

  it('returns fail verdict with feedback for VERDICT: FAIL followed by text', () => {
    const response =
      'Q1. yes\nQ2. no\nQ3. yes\nQ4. yes\n\nVERDICT: FAIL\nThe output is missing the introduction section and lacks specific data points.';
    const { verdict, feedback } = parseVerdict(response);
    expect(verdict).toBe('fail');
    expect(feedback).toBe('The output is missing the introduction section and lacks specific data points.');
  });

  it('uses fallback message when VERDICT: FAIL has no text after it', () => {
    const response = 'VERDICT: FAIL';
    const { verdict, feedback } = parseVerdict(response);
    expect(verdict).toBe('fail');
    expect(feedback).toBe('Validation failed without specific feedback.');
  });

  it('returns unknown verdict when response has no verdict marker', () => {
    const response = 'The output looks pretty good overall but I cannot say for certain.';
    const { verdict, feedback } = parseVerdict(response);
    expect(verdict).toBe('unknown');
    expect(feedback).toBe('');
  });

  it('is case-insensitive for PASS', () => {
    const response = 'verdict: pass';
    const { verdict } = parseVerdict(response);
    expect(verdict).toBe('pass');
  });

  it('is case-insensitive for FAIL', () => {
    const response = 'verdict: fail\nNeeds more detail.';
    const { verdict, feedback } = parseVerdict(response);
    expect(verdict).toBe('fail');
    expect(feedback).toBe('Needs more detail.');
  });

  it('handles extra whitespace around the verdict keyword', () => {
    const response = 'VERDICT:   PASS';
    const { verdict } = parseVerdict(response);
    expect(verdict).toBe('pass');
  });

  it('prefers PASS when both markers somehow appear (PASS check runs first)', () => {
    // Edge case: malformed response containing both
    const response = 'VERDICT: PASS\nVERDICT: FAIL\nSome feedback.';
    const { verdict } = parseVerdict(response);
    expect(verdict).toBe('pass');
  });

  it('strips only the verdict line and preserves multiline feedback', () => {
    const response = 'VERDICT: FAIL\nParagraph one.\n\nParagraph two.';
    const { feedback } = parseVerdict(response);
    expect(feedback).toBe('Paragraph one.\n\nParagraph two.');
  });
});
