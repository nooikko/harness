import { describe, expect, it } from 'vitest';
import { isValidCharacterName } from '../is-valid-character-name';

describe('isValidCharacterName', () => {
  describe('valid names', () => {
    it.each(['Quinn', 'The Expander', 'Grey Sweatpants', 'CIS 405 Guy', 'Mr. Kim', 'Coach Sarah', 'User'])('accepts %s', (name) => {
      expect(isValidCharacterName(name)).toEqual({ valid: true });
    });
  });

  describe('valid edge cases', () => {
    it('accepts single character name', () => {
      expect(isValidCharacterName('A')).toEqual({ valid: true });
    });

    it('accepts hyphenated name', () => {
      expect(isValidCharacterName('Jean-Pierre')).toEqual({ valid: true });
    });

    it('accepts multi-word name within limit', () => {
      expect(isValidCharacterName('Mary Jane Watson')).toEqual({ valid: true });
    });
  });

  describe('invalid - empty', () => {
    it('rejects empty string', () => {
      expect(isValidCharacterName('')).toEqual({
        valid: false,
        reason: 'empty name',
      });
    });

    it('rejects whitespace-only string', () => {
      expect(isValidCharacterName('  ')).toEqual({
        valid: false,
        reason: 'empty name',
      });
    });
  });

  describe('invalid - too long', () => {
    it('rejects name exceeding 60 characters', () => {
      const longName = 'A'.repeat(70);
      expect(isValidCharacterName(longName)).toEqual({
        valid: false,
        reason: 'exceeds 60 characters',
      });
    });
  });

  describe('invalid - too many words', () => {
    it('rejects name with more than 5 words', () => {
      expect(isValidCharacterName('this is way too many words here')).toEqual({
        valid: false,
        reason: 'more than 5 words',
      });
    });
  });

  describe('invalid - description punctuation', () => {
    it('rejects semicolons', () => {
      expect(isValidCharacterName('mentioned; not present')).toEqual({
        valid: false,
        reason: 'contains description punctuation',
      });
    });

    it('rejects colons', () => {
      expect(isValidCharacterName('unknown: referred to by nickname')).toEqual({
        valid: false,
        reason: 'contains description punctuation',
      });
    });
  });

  describe('invalid - description markers', () => {
    it.each([
      ['mentioned in story', 'contains description markers'],
      ['unknown name here', 'contains description markers'],
      ['not present now', 'contains description markers'],
      ['does not exist', 'contains description markers'],
      ['referred to by name', 'contains description markers'],
      ['n/a', 'contains description markers'],
    ])("rejects '%s' with reason '%s'", (name, reason) => {
      expect(isValidCharacterName(name)).toEqual({ valid: false, reason });
    });
  });
});
