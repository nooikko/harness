import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { highlightMatches } from '../highlight-matches';

const render = (nodes: React.ReactNode[]) => renderToStaticMarkup(<span>{nodes}</span>);

describe('highlightMatches', () => {
  it('highlights a single word match', () => {
    const result = render(highlightMatches('hello world', 'world'));
    expect(result).toContain('<mark');
    expect(result).toContain('world');
  });

  it('highlights multiple occurrences', () => {
    const result = render(highlightMatches('the cat sat on the mat', 'the'));
    const marks = result.match(/<mark/g);
    expect(marks).toHaveLength(2);
  });

  it('matches case-insensitively', () => {
    const result = render(highlightMatches('Hello World', 'hello'));
    expect(result).toContain('<mark');
    expect(result).toContain('Hello');
  });

  it('escapes regex special characters', () => {
    const result = render(highlightMatches('price is $100.00', '$100.00'));
    expect(result).toContain('<mark');
    expect(result).toContain('$100.00');
  });

  it('returns plain text when no match', () => {
    const result = render(highlightMatches('hello world', 'xyz'));
    expect(result).not.toContain('<mark');
    expect(result).toContain('hello world');
  });

  it('returns plain text when query is empty', () => {
    const result = render(highlightMatches('hello world', ''));
    expect(result).not.toContain('<mark');
    expect(result).toContain('hello world');
  });

  it('returns plain text when query is whitespace', () => {
    const result = render(highlightMatches('hello world', '   '));
    expect(result).not.toContain('<mark');
    expect(result).toContain('hello world');
  });

  it('highlights multi-word queries independently', () => {
    const result = render(highlightMatches('the quick brown fox', 'quick fox'));
    const marks = result.match(/<mark/g);
    expect(marks).toHaveLength(2);
    expect(result).toContain('quick');
    expect(result).toContain('fox');
  });
});
