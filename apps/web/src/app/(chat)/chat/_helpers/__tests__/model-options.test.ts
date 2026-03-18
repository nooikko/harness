import { describe, expect, it } from 'vitest';
import { MODEL_OPTIONS } from '../model-options';

describe('MODEL_OPTIONS', () => {
  it('is an array', () => {
    expect(Array.isArray(MODEL_OPTIONS)).toBe(true);
  });

  it('has four entries', () => {
    expect(MODEL_OPTIONS).toHaveLength(4);
  });

  it('first entry is the default Haiku option with empty value', () => {
    expect(MODEL_OPTIONS[0]).toEqual({ value: '', label: 'Haiku', description: 'Default' });
  });

  it('includes claude-sonnet-4-6', () => {
    expect(MODEL_OPTIONS.some((o) => o.value === 'claude-sonnet-4-6')).toBe(true);
  });

  it('includes claude-opus-4-6', () => {
    expect(MODEL_OPTIONS.some((o) => o.value === 'claude-opus-4-6')).toBe(true);
  });

  it('every entry has a non-empty label', () => {
    for (const opt of MODEL_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
