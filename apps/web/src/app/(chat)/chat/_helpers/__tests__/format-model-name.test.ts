import { describe, expect, it } from 'vitest';
import { formatModelName } from '../format-model-name';

describe('formatModelName', () => {
  it('returns "Haiku" for claude-haiku-4-5-20251001', () => {
    expect(formatModelName('claude-haiku-4-5-20251001')).toBe('Haiku');
  });

  it('returns "Sonnet" for claude-sonnet-4-6', () => {
    expect(formatModelName('claude-sonnet-4-6')).toBe('Sonnet');
  });

  it('returns "Opus" for claude-opus-4-6', () => {
    expect(formatModelName('claude-opus-4-6')).toBe('Opus');
  });

  it('returns the raw model string for unknown models', () => {
    expect(formatModelName('claude-future-99')).toBe('claude-future-99');
  });
});
