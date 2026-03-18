import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { detectDialogueBlock } from '../detect-dialogue-block';

describe('detectDialogueBlock', () => {
  it('detects strong element followed by colon-quote as dialogue', () => {
    const children = [createElement('strong', null, 'SAM'), ': "Hello there"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(result.speaker).toBe('SAM');
      expect(result.emotion).toBeUndefined();
    }
  });

  it('detects emotion in <em> between strong and colon', () => {
    const children = [createElement('strong', null, 'SAM'), ' ', createElement('em', null, '(hesitant)'), ': "I don\'t know..."'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(result.speaker).toBe('SAM');
      expect(result.emotion).toBe('hesitant');
    }
  });

  it('handles hyphenated names', () => {
    const children = [createElement('strong', null, 'MARY-JANE'), ': "Hi there"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(result.speaker).toBe('MARY-JANE');
    }
  });

  it('returns isDialogue=false for strong without colon-quote pattern', () => {
    const children = [createElement('strong', null, 'bold text'), ' without colon quote'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(false);
  });

  it('returns isDialogue=false for empty children', () => {
    const result = detectDialogueBlock([]);
    expect(result.isDialogue).toBe(false);
  });

  it('returns isDialogue=false for plain text children', () => {
    const result = detectDialogueBlock('Just some text');
    expect(result.isDialogue).toBe(false);
  });

  it('returns isDialogue=false when first child is not strong', () => {
    const children = [createElement('em', null, 'italic'), ': "some text"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(false);
  });

  it('includes rest children from colon onward', () => {
    const children = [createElement('strong', null, 'SAM'), ': "Hello"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(Array.isArray(result.restChildren)).toBe(true);
    }
  });

  it('returns isDialogue=false when strong has empty text', () => {
    const children = [createElement('strong', null, ''), ': "text"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(false);
  });

  it('handles emotion without parentheses', () => {
    const children = [createElement('strong', null, 'SAM'), ' ', createElement('em', null, 'softly'), ': "Hey"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(result.emotion).toBe('softly');
    }
  });

  it('returns isDialogue=false when unexpected element appears before colon', () => {
    const children = [createElement('strong', null, 'SAM'), createElement('div', null, 'unexpected'), ': "text"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(false);
  });

  it('handles null/undefined children gracefully', () => {
    const result = detectDialogueBlock(null);
    expect(result.isDialogue).toBe(false);
  });

  it('handles strong with nested array children', () => {
    const children = [createElement('strong', null, 'DR', '.', ' ', 'SMITH'), ': "Hello"'];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(true);
    if (result.isDialogue) {
      expect(result.speaker).toBe('DR. SMITH');
    }
  });

  it('returns isDialogue=false when only strong element with no other content', () => {
    const children = [createElement('strong', null, 'SAM')];
    const result = detectDialogueBlock(children);
    expect(result.isDialogue).toBe(false);
  });
});
