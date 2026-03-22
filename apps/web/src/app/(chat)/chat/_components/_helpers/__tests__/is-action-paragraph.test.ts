import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { isActionParagraph } from '../is-action-paragraph';

describe('isActionParagraph', () => {
  it('returns true for a single em element', () => {
    const children = createElement('em', null, 'She turned in the passenger seat.');
    expect(isActionParagraph(children)).toBe(true);
  });

  it('returns true for multiple em elements with whitespace', () => {
    const em1 = createElement('em', { key: '1' }, 'She paused, ');
    const em2 = createElement('em', { key: '2' }, 'then continued.');
    expect(isActionParagraph([em1, ' ', em2])).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isActionParagraph('Just a plain paragraph.')).toBe(false);
  });

  it('returns false for mixed content (em + text)', () => {
    const children = [createElement('em', { key: '1' }, 'italic'), ' and plain text'];
    expect(isActionParagraph(children)).toBe(false);
  });

  it('returns false for strong element', () => {
    const children = createElement('strong', null, 'MORGAN');
    expect(isActionParagraph(children)).toBe(false);
  });

  it('returns false for empty children', () => {
    expect(isActionParagraph(null)).toBe(false);
    expect(isActionParagraph([])).toBe(false);
  });
});
