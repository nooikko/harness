import { describe, expect, it } from 'vitest';
import { detectUserFacts } from '../detect-user-facts';

describe('detectUserFacts', () => {
  it('returns null when userFact is undefined', () => {
    expect(detectUserFacts({})).toBeNull();
  });

  it('returns null when userFact is empty string', () => {
    expect(detectUserFacts({ userFact: '' })).toBeNull();
  });

  it('returns null when userFact is whitespace only', () => {
    expect(detectUserFacts({ userFact: '   \n  ' })).toBeNull();
  });

  it('returns trimmed string when userFact is present', () => {
    expect(detectUserFacts({ userFact: '  has ADD  ' })).toBe('has ADD');
  });

  it('returns the fact as-is when no trimming needed', () => {
    expect(detectUserFacts({ userFact: 'prefers short responses' })).toBe('prefers short responses');
  });
});
