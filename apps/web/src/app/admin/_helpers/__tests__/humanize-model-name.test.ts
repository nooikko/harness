import { describe, expect, it } from 'vitest';
import { humanizeModelName } from '../humanize-model-name';

describe('humanizeModelName', () => {
  describe('known model mappings', () => {
    it('maps claude-haiku-4-5-20251001 to Haiku 4.5', () => {
      expect(humanizeModelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
    });

    it('maps claude-haiku-4-5 to Haiku 4.5', () => {
      expect(humanizeModelName('claude-haiku-4-5')).toBe('Haiku 4.5');
    });

    it('maps claude-haiku-3.5-20241022 to Haiku 3.5', () => {
      expect(humanizeModelName('claude-haiku-3.5-20241022')).toBe('Haiku 3.5');
    });

    it('maps claude-sonnet-4-6 to Sonnet 4.6', () => {
      expect(humanizeModelName('claude-sonnet-4-6')).toBe('Sonnet 4.6');
    });

    it('maps claude-sonnet-4-5-20250514 to Sonnet 4.5', () => {
      expect(humanizeModelName('claude-sonnet-4-5-20250514')).toBe('Sonnet 4.5');
    });

    it('maps claude-sonnet-4-20250514 to Sonnet 4', () => {
      expect(humanizeModelName('claude-sonnet-4-20250514')).toBe('Sonnet 4');
    });

    it('maps claude-opus-4-6 to Opus 4.6', () => {
      expect(humanizeModelName('claude-opus-4-6')).toBe('Opus 4.6');
    });

    it('maps claude-opus-4-5-20250514 to Opus 4.5', () => {
      expect(humanizeModelName('claude-opus-4-5-20250514')).toBe('Opus 4.5');
    });

    it('maps claude-opus-4-20250514 to Opus 4', () => {
      expect(humanizeModelName('claude-opus-4-20250514')).toBe('Opus 4');
    });
  });

  describe('best-effort fallback for unknown models', () => {
    it('extracts family and version from an unrecognised haiku variant', () => {
      expect(humanizeModelName('claude-haiku-5-0-20260101')).toBe('Haiku 5.0');
    });

    it('extracts family and version from an unrecognised sonnet variant', () => {
      expect(humanizeModelName('claude-sonnet-5-2-20270201')).toBe('Sonnet 5.2');
    });

    it('extracts family and version from an unrecognised opus variant', () => {
      expect(humanizeModelName('claude-opus-5-0-20270301')).toBe('Opus 5.0');
    });

    it('returns model ID unchanged when no known family is present', () => {
      expect(humanizeModelName('some-unknown-model-12345')).toBe('some-unknown-model-12345');
    });

    it('returns model ID unchanged for a completely unrelated string', () => {
      expect(humanizeModelName('gpt-4o')).toBe('gpt-4o');
    });
  });

  describe('edge cases', () => {
    it('returns empty string unchanged', () => {
      expect(humanizeModelName('')).toBe('');
    });
  });
});
