'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SearchPalette } from './search-palette';

type SearchTriggerComponent = () => React.ReactNode;

export const SearchTrigger: SearchTriggerComponent = () => {
  const [open, setOpen] = useState(false);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClick = useCallback(() => setOpen(true), []);

  return (
    <>
      <button
        type='button'
        onClick={handleClick}
        className='flex w-64 items-center gap-2 rounded-md border border-border/60 px-2.5 py-1 text-left transition-colors hover:bg-muted/50'
        aria-label='Open command palette'
      >
        <Search className='h-3 w-3 shrink-0 text-muted-foreground/60' />
        <span className='flex-1 text-xs text-muted-foreground/60'>Search…</span>
        <kbd className='rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60'>⌘K</kbd>
      </button>
      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  );
};
