import { describe, expect, it } from 'vitest';
import { categorizeFailure } from '../categorize-failure';

describe('categorizeFailure', () => {
  it('returns unknown for undefined error', () => {
    expect(categorizeFailure(undefined)).toBe('unknown');
  });

  it('returns timeout for timed out messages', () => {
    expect(categorizeFailure('Timed out after 300000ms')).toBe('timeout');
    expect(categorizeFailure('Operation timeout')).toBe('timeout');
  });

  it('returns logic-error for JSON parse failures', () => {
    expect(categorizeFailure('JSON parse error in tool call')).toBe('logic-error');
    expect(categorizeFailure('Failed to parse response')).toBe('logic-error');
    expect(categorizeFailure('Invalid tool invocation')).toBe('logic-error');
  });

  it('returns logic-error for memory/limit failures', () => {
    expect(categorizeFailure('Memory limit exceeded')).toBe('logic-error');
    expect(categorizeFailure('Context limit exceeded')).toBe('logic-error');
  });

  it('returns crash for process crash/kill signals', () => {
    expect(categorizeFailure('Process was killed')).toBe('crash');
    expect(categorizeFailure('Session crashed unexpectedly')).toBe('crash');
    expect(categorizeFailure('Received abort signal')).toBe('crash');
  });

  it('returns unknown for unrecognized errors', () => {
    expect(categorizeFailure('Something went wrong')).toBe('unknown');
    expect(categorizeFailure('Network error')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(categorizeFailure('TIMED OUT after 300000ms')).toBe('timeout');
    expect(categorizeFailure('JSON Parse Error')).toBe('logic-error');
  });
});
