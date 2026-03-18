import { describe, expect, it } from 'vitest';
import { getCharacterColor } from '../character-color-map';

describe('getCharacterColor', () => {
  it('returns the same color for the same name (deterministic)', () => {
    const color1 = getCharacterColor('SAM');
    const color2 = getCharacterColor('SAM');
    expect(color1).toBe(color2);
  });

  it('is case insensitive', () => {
    const upper = getCharacterColor('SAM');
    const mixed = getCharacterColor('Sam');
    const lower = getCharacterColor('sam');
    expect(upper).toBe(mixed);
    expect(mixed).toBe(lower);
  });

  it('produces at least 3 distinct colors across 5 different names', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
    const colors = new Set(names.map((n) => getCharacterColor(n)));
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it('returns a valid hex color (#RRGGBB)', () => {
    const color = getCharacterColor('TestName');
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('uses override color when provided as valid hex', () => {
    const override = '#FF00FF';
    const color = getCharacterColor('SAM', override);
    expect(color).toBe(override);
  });

  it('falls back to hash when override is not valid hex', () => {
    const hashColor = getCharacterColor('SAM');
    const withBadOverride = getCharacterColor('SAM', 'not-a-hex');
    expect(withBadOverride).toBe(hashColor);
  });

  it('falls back to hash when override is null', () => {
    const hashColor = getCharacterColor('SAM');
    const withNull = getCharacterColor('SAM', null);
    expect(withNull).toBe(hashColor);
  });

  it('handles many names without erroring (palette wraps)', () => {
    const names = Array.from({ length: 100 }, (_, i) => `Character${i}`);
    const colors = names.map((n) => getCharacterColor(n));
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('trims whitespace from names', () => {
    const trimmed = getCharacterColor('SAM');
    const padded = getCharacterColor('  SAM  ');
    expect(trimmed).toBe(padded);
  });
});
