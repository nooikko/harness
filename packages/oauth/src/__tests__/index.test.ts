import { describe, expect, it } from 'vitest';
import { isProviderSupported } from '../index';

describe('isProviderSupported', () => {
  it('returns true for microsoft', () => {
    expect(isProviderSupported('microsoft')).toBe(true);
  });

  it('returns true for google', () => {
    expect(isProviderSupported('google')).toBe(true);
  });

  it('returns false for unsupported providers', () => {
    expect(isProviderSupported('github')).toBe(false);
  });
});
