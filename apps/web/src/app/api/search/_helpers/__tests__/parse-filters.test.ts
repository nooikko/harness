import { describe, expect, it } from 'vitest';
import { parseFilters } from '../parse-filters';

describe('parseFilters', () => {
  it('returns search terms with no filters', () => {
    const result = parseFilters('hello world');
    expect(result.searchTerms).toBe('hello world');
    expect(result.filters).toEqual({});
  });

  it('extracts agent filter', () => {
    const result = parseFilters('agent:primary hello');
    expect(result.filters.agent).toBe('primary');
    expect(result.searchTerms).toBe('hello');
  });

  it('extracts project filter', () => {
    const result = parseFilters('project:harness search query');
    expect(result.filters.project).toBe('harness');
    expect(result.searchTerms).toBe('search query');
  });

  it('extracts thread (in:) filter', () => {
    const result = parseFilters('in:my-thread something');
    expect(result.filters.thread).toBe('my-thread');
    expect(result.searchTerms).toBe('something');
  });

  it('extracts role filter for user', () => {
    const result = parseFilters('from:user question');
    expect(result.filters.role).toBe('user');
    expect(result.searchTerms).toBe('question');
  });

  it('extracts role filter for assistant', () => {
    const result = parseFilters('from:assistant answer');
    expect(result.filters.role).toBe('assistant');
    expect(result.searchTerms).toBe('answer');
  });

  it('extracts has:file filter', () => {
    const result = parseFilters('has:file report');
    expect(result.filters.hasFile).toBe(true);
    expect(result.searchTerms).toBe('report');
  });

  it('extracts file: filter', () => {
    const result = parseFilters('file:readme.md content');
    expect(result.filters.fileName).toBe('readme.md');
    expect(result.searchTerms).toBe('content');
  });

  it('extracts before: date filter', () => {
    const result = parseFilters('before:2026-03-01 old stuff');
    expect(result.filters.before).toEqual(new Date('2026-03-01'));
    expect(result.searchTerms).toBe('old stuff');
  });

  it('extracts after: date filter', () => {
    const result = parseFilters('after:2026-01-15 new stuff');
    expect(result.filters.after).toEqual(new Date('2026-01-15'));
    expect(result.searchTerms).toBe('new stuff');
  });

  it('ignores invalid dates', () => {
    const result = parseFilters('before:not-a-date query');
    expect(result.filters.before).toBeUndefined();
    expect(result.searchTerms).toBe('query');
  });

  it('extracts multiple filters at once', () => {
    const result = parseFilters('agent:primary has:file quarterly report');
    expect(result.filters.agent).toBe('primary');
    expect(result.filters.hasFile).toBe(true);
    expect(result.searchTerms).toBe('quarterly report');
  });

  it('handles filters case-insensitively', () => {
    const result = parseFilters('Agent:Primary hello');
    expect(result.filters.agent).toBe('Primary');
    expect(result.searchTerms).toBe('hello');
  });

  it('handles empty input', () => {
    const result = parseFilters('');
    expect(result.searchTerms).toBe('');
    expect(result.filters).toEqual({});
  });

  it('handles filter-only input with no search terms', () => {
    const result = parseFilters('agent:primary');
    expect(result.filters.agent).toBe('primary');
    expect(result.searchTerms).toBe('');
  });

  it('collapses extra whitespace after filter removal', () => {
    const result = parseFilters('hello  agent:primary  world');
    expect(result.filters.agent).toBe('primary');
    expect(result.searchTerms).toBe('hello world');
  });

  it('is stateless across repeated calls (no global regex bug)', () => {
    const result1 = parseFilters('agent:claude hello');
    const result2 = parseFilters('agent:sonnet world');
    const result3 = parseFilters('agent:opus test');

    expect(result1.filters.agent).toBe('claude');
    expect(result2.filters.agent).toBe('sonnet');
    expect(result3.filters.agent).toBe('opus');
  });
});
