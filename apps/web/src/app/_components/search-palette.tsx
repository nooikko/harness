'use client';

import { CommandDialog, CommandEmpty, CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList } from '@harness/ui';
import { CheckSquare, Clock, FileText, FolderOpen, Hash, Loader2, MessageSquare, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FILTER_PATTERNS, parseSearchFilters } from '@/app/_helpers/parse-search-filters';
import { highlightMatches } from './_helpers/highlight-matches';
import { SearchFilterChips } from './_helpers/search-filter-chips';
import { useRecentSearches } from './_helpers/use-recent-searches';

type SearchResult = {
  type: 'thread' | 'message' | 'file' | 'agent' | 'project' | 'task';
  id: string;
  title: string;
  preview: string;
  score: number;
  meta: {
    threadId?: string;
    threadName?: string;
    projectName?: string;
    agentName?: string;
    createdAt: string;
  };
};

type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TYPE_ICONS = {
  thread: Hash,
  message: MessageSquare,
  file: FileText,
  agent: User,
  project: FolderOpen,
  task: CheckSquare,
} as const;

const TYPE_LABELS = {
  thread: 'Threads',
  message: 'Messages',
  file: 'Files',
  agent: 'Agents',
  project: 'Projects',
  task: 'Tasks',
} as const;

type SearchPaletteComponent = (props: SearchPaletteProps) => React.ReactNode;

export const SearchPalette: SearchPaletteComponent = ({ open, onOpenChange }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);
  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useRecentSearches();

  const { searchTerms, filters } = useMemo(() => parseSearchFilters(query), [query]);
  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  const search = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 20 }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error('Search failed');
        }
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);

        // Save successful searches to recents
        if (data.results.length > 0) {
          addRecentSearch(searchQuery);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [addRecentSearch],
  );

  const handleValueChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search],
  );

  // Reset on close — cancel pending debounce and in-flight fetch
  useEffect(() => {
    if (!open) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
      setQuery('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      switch (result.type) {
        case 'thread':
          router.push(`/chat/${result.id}`);
          break;
        case 'message':
          if (result.meta.threadId) {
            router.push(`/chat/${result.meta.threadId}?highlight=${result.id}`);
          }
          break;
        case 'agent':
          router.push(`/agents/${result.id}`);
          break;
        case 'project':
          router.push(`/chat/projects/${result.id}`);
          break;
        case 'file':
          if (result.meta.threadId) {
            router.push(`/chat/${result.meta.threadId}`);
          }
          break;
        case 'task':
          router.push('/tasks');
          break;
      }
    },
    [router, onOpenChange],
  );

  const handleSelectRecent = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      search(recentQuery);
    },
    [search],
  );

  const handleRemoveFilter = useCallback(
    (filterKey: string) => {
      const pattern = FILTER_PATTERNS[filterKey as keyof typeof FILTER_PATTERNS];
      if (!pattern) {
        return;
      }
      const cleaned = query.replace(pattern, '').replace(/\s+/g, ' ').trim();
      setQuery(cleaned);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      search(cleaned);
    },
    [query, search],
  );

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const group = acc[result.type] ?? [];
    group.push(result);
    acc[result.type] = group;
    return acc;
  }, {});

  const showRecents = query.trim().length === 0 && recentSearches.length > 0 && !loading;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title='Search' description='Search threads, messages, files, agents, and projects'>
      <CommandInput placeholder='Search… (try agent:name or in:thread)' value={query} onValueChange={handleValueChange} />
      {hasActiveFilters && <SearchFilterChips filters={filters} onRemoveFilter={handleRemoveFilter} />}
      <CommandList>
        {loading && (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
          </div>
        )}
        {!loading && query.trim().length >= 2 && results.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}
        {!loading && query.trim().length < 2 && query.length > 0 && <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>}
        {showRecents && (
          <CommandGroup
            heading={
              <span className='flex items-center justify-between'>
                <span>Recent Searches</span>
                <button
                  type='button'
                  onClick={clearRecentSearches}
                  className='text-[11px] font-normal text-muted-foreground/60 hover:text-muted-foreground'
                >
                  Clear
                </button>
              </span>
            }
          >
            {recentSearches.map((recentQuery) => (
              <CommandItem
                key={recentQuery}
                value={`recent-${recentQuery}`}
                onSelect={() => handleSelectRecent(recentQuery)}
                className='group flex items-center gap-2.5 py-1.5'
              >
                <Clock className='h-3.5 w-3.5 shrink-0 text-muted-foreground/50' />
                <span className='flex-1 truncate text-sm text-muted-foreground'>{recentQuery}</span>
                <button
                  type='button'
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentSearch(recentQuery);
                  }}
                  className='rounded-full p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100'
                  aria-label={`Remove ${recentQuery} from recent searches`}
                >
                  <X className='h-3 w-3 text-muted-foreground/60' />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {Object.entries(grouped).map(([type, items]) => {
          const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
          const label = TYPE_LABELS[type as keyof typeof TYPE_LABELS];
          return (
            <CommandGroup key={type} heading={label}>
              {items.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.id}-${result.title}`}
                  onSelect={() => handleSelect(result)}
                  className='flex items-start gap-2.5 py-2'
                >
                  <Icon className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm font-medium'>{highlightMatches(result.title, searchTerms)}</div>
                    <div className='truncate text-xs text-muted-foreground'>{highlightMatches(result.preview, searchTerms)}</div>
                    {(result.meta.projectName || result.meta.agentName) && (
                      <div className='mt-0.5 flex gap-2 text-[11px] text-muted-foreground/60'>
                        {result.meta.projectName && <span>{result.meta.projectName}</span>}
                        {result.meta.agentName && <span>@{result.meta.agentName}</span>}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
      <CommandFooter />
    </CommandDialog>
  );
};
