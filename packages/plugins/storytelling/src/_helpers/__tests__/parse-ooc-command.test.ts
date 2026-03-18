import { describe, expect, it } from 'vitest';
import { parseOocCommand } from '../parse-ooc-command';

describe('parseOocCommand', () => {
  describe('rename', () => {
    it('parses rename with quoted strings', () => {
      const result = parseOocCommand('rename "the cheerleader" to "Mikenze"');
      expect(result.type).toBe('rename');
      expect(result.params.from).toBe('the cheerleader');
      expect(result.params.to).toBe('Mikenze');
    });

    it('parses rename with single-quoted strings', () => {
      const result = parseOocCommand("rename 'Guard' to 'Captain Holt'");
      expect(result.type).toBe('rename');
      expect(result.params.from).toBe('Guard');
      expect(result.params.to).toBe('Captain Holt');
    });

    it('returns empty params when no quotes are found', () => {
      const result = parseOocCommand('rename the guard');
      expect(result.type).toBe('rename');
      expect(result.params.from).toBe('');
      expect(result.params.to).toBe('');
    });
  });

  describe('knowledge', () => {
    it("parses doesn't know", () => {
      const result = parseOocCommand("Elena doesn't know about the betrayal");
      expect(result.type).toBe('knowledge');
      expect(result.params.character).toBe('Elena');
      expect(result.params.topic).toBe('about the betrayal');
    });

    it('parses does not know', () => {
      const result = parseOocCommand('Sir Aldric does not know the secret password');
      expect(result.type).toBe('knowledge');
      expect(result.params.character).toBe('Sir Aldric');
      expect(result.params.topic).toBe('the secret password');
    });
  });

  describe('personality', () => {
    it('parses make X more Y', () => {
      const result = parseOocCommand('make Elena more aggressive');
      expect(result.type).toBe('personality');
      expect(result.params.character).toBe('Elena');
      expect(result.params.trait).toBe('more aggressive');
    });

    it('parses make X less Y', () => {
      const result = parseOocCommand('make the guard less trusting');
      expect(result.type).toBe('personality');
      expect(result.params.character).toBe('the guard');
      expect(result.params.trait).toBe('less trusting');
    });
  });

  describe('remove', () => {
    it('parses remove X from the story', () => {
      const result = parseOocCommand('remove the innkeeper from the story');
      expect(result.type).toBe('remove');
      expect(result.params.character).toBe('the innkeeper');
    });
  });

  describe('color', () => {
    it('detects color command', () => {
      const result = parseOocCommand('change the color for "Elena" and "Aldric"');
      expect(result.type).toBe('color');
      expect(result.params.characters).toBe('Elena, Aldric');
    });

    it('returns empty characters when no quotes', () => {
      const result = parseOocCommand('assign color to the characters');
      expect(result.type).toBe('color');
      expect(result.params.characters).toBe('');
    });
  });

  describe('time', () => {
    it("parses it's now", () => {
      const result = parseOocCommand("it's now midnight");
      expect(result.type).toBe('time');
      expect(result.params.time).toBe('midnight');
    });

    it('parses its now (no apostrophe)', () => {
      const result = parseOocCommand('its now early morning');
      expect(result.type).toBe('time');
      expect(result.params.time).toBe('early morning');
    });

    it('parses time is', () => {
      const result = parseOocCommand('time is three hours later');
      expect(result.type).toBe('time');
      expect(result.params.time).toBe('three hours later');
    });
  });

  describe('location', () => {
    it("parses we're at", () => {
      const result = parseOocCommand("we're at the tavern");
      expect(result.type).toBe('location');
      expect(result.params.location).toBe('the tavern');
    });

    it('parses we are at', () => {
      const result = parseOocCommand('we are at the castle gates');
      expect(result.type).toBe('location');
      expect(result.params.location).toBe('the castle gates');
    });
  });

  describe('unknown', () => {
    it('returns unknown for unrecognized commands', () => {
      const result = parseOocCommand('I want to change the mood to dark');
      expect(result.type).toBe('unknown');
      expect(result.params).toEqual({});
    });

    it('returns unknown for empty input', () => {
      const result = parseOocCommand('');
      expect(result.type).toBe('unknown');
      expect(result.params).toEqual({});
    });
  });
});
