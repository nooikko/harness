import { useCallback, useState } from 'react';

const STORAGE_KEY = 'harness:recent-searches';
const MAX_ENTRIES = 8;

type UseRecentSearchesReturn = {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
};

type UseRecentSearches = () => UseRecentSearchesReturn;

type ReadStorage = () => string[];

const readStorage: ReadStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
};

type WriteStorage = (items: string[]) => void;

const writeStorage: WriteStorage = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable or quota exceeded — silently ignore
  }
};

export const useRecentSearches: UseRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<string[]>(readStorage);

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
      writeStorage(next);
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item.toLowerCase() !== query.toLowerCase());
      writeStorage(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    writeStorage([]);
  }, []);

  return { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches };
};
