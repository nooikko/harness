import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecentSearches } from '../use-recent-searches';

const STORAGE_KEY = 'harness:recent-searches';

describe('useRecentSearches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no stored searches', () => {
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.recentSearches).toEqual([]);
  });

  it('adds a recent search', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch('test query'));
    expect(result.current.recentSearches).toEqual(['test query']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['test query']);
  });

  it('prepends new searches (most recent first)', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch('first'));
    act(() => result.current.addRecentSearch('second'));
    expect(result.current.recentSearches).toEqual(['second', 'first']);
  });

  it('deduplicates case-insensitively', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch('Hello'));
    act(() => result.current.addRecentSearch('hello'));
    expect(result.current.recentSearches).toEqual(['hello']);
  });

  it('limits to 8 entries', () => {
    const { result } = renderHook(() => useRecentSearches());
    for (let i = 0; i < 10; i++) {
      act(() => result.current.addRecentSearch(`query ${i}`));
    }
    expect(result.current.recentSearches).toHaveLength(8);
    expect(result.current.recentSearches[0]).toBe('query 9');
  });

  it('removes an individual entry', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch('keep'));
    act(() => result.current.addRecentSearch('remove'));
    act(() => result.current.removeRecentSearch('remove'));
    expect(result.current.recentSearches).toEqual(['keep']);
  });

  it('clears all entries', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch('one'));
    act(() => result.current.addRecentSearch('two'));
    act(() => result.current.clearRecentSearches());
    expect(result.current.recentSearches).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('ignores empty/whitespace queries', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.addRecentSearch(''));
    act(() => result.current.addRecentSearch('   '));
    expect(result.current.recentSearches).toEqual([]);
  });

  it('reads existing data from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['saved query']));
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.recentSearches).toEqual(['saved query']);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.recentSearches).toEqual([]);
  });

  it('handles localStorage unavailable gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.recentSearches).toEqual([]);
    vi.restoreAllMocks();
  });
});
