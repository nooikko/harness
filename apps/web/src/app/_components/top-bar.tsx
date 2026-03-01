import { Search } from 'lucide-react';
import Link from 'next/link';

type TopBarComponent = () => React.ReactNode;

export const TopBar: TopBarComponent = () => (
  <header className='relative flex h-14 shrink-0 items-center border-b border-border bg-background px-6'>
    <Link href='/' className='text-lg font-semibold tracking-tight text-foreground'>
      Harness
    </Link>
    {/* Cmd+K search — centered in the bar, visual placeholder until command palette is wired */}
    <div className='absolute left-1/2 -translate-x-1/2'>
      <button
        type='button'
        className='flex w-60 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-left transition-colors hover:bg-muted/50'
        aria-label='Open command palette'
      >
        <Search className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
        <span className='flex-1 text-xs text-muted-foreground'>Search…</span>
        <kbd className='rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>⌘K</kbd>
      </button>
    </div>
  </header>
);
