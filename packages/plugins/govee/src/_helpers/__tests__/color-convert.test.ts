import { describe, expect, it } from 'vitest';
import { hexToRgbInt, namedColorToRgbInt, rgbIntToHex } from '../color-convert';

describe('hexToRgbInt', () => {
  it('converts pure red #ff0000 to 16711680', () => {
    expect(hexToRgbInt('#ff0000')).toBe(16711680);
  });

  it('converts pure green #00ff00 to 65280', () => {
    expect(hexToRgbInt('#00ff00')).toBe(65280);
  });

  it('converts pure blue #0000ff to 255', () => {
    expect(hexToRgbInt('#0000ff')).toBe(255);
  });

  it('converts white #ffffff to 16777215', () => {
    expect(hexToRgbInt('#ffffff')).toBe(16777215);
  });

  it('converts black #000000 to 0', () => {
    expect(hexToRgbInt('#000000')).toBe(0);
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgbInt('ff6600')).toBe(0xff6600);
  });

  it('handles uppercase hex', () => {
    expect(hexToRgbInt('#FF0000')).toBe(16711680);
  });

  it('throws on invalid hex string', () => {
    expect(() => hexToRgbInt('not-a-color')).toThrow();
  });

  it('throws on short hex', () => {
    expect(() => hexToRgbInt('#fff')).toThrow();
  });
});

describe('rgbIntToHex', () => {
  it('converts 16711680 to #ff0000', () => {
    expect(rgbIntToHex(16711680)).toBe('#ff0000');
  });

  it('converts 255 to #0000ff', () => {
    expect(rgbIntToHex(255)).toBe('#0000ff');
  });

  it('converts 0 to #000000', () => {
    expect(rgbIntToHex(0)).toBe('#000000');
  });

  it('round-trips with hexToRgbInt', () => {
    expect(rgbIntToHex(hexToRgbInt('#ff6600'))).toBe('#ff6600');
  });
});

describe('namedColorToRgbInt', () => {
  it("resolves 'red'", () => {
    expect(namedColorToRgbInt('red')).toBe(0xff0000);
  });

  it("resolves 'warm white'", () => {
    const result = namedColorToRgbInt('warm white');
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(namedColorToRgbInt('RED')).toBe(namedColorToRgbInt('red'));
  });

  it('returns null for unknown names', () => {
    expect(namedColorToRgbInt('ultraviolet-sparkle')).toBeNull();
  });
});
