import { prisma } from '@harness/database';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { UserMenu } from './user-menu';

type TopBarComponent = () => Promise<React.ReactNode>;

export const TopBar: TopBarComponent = async () => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
    select: { name: true },
  });

  const name = profile?.name ?? 'User';

  return (
    <header className='flex h-12 shrink-0 items-center border-b border-border bg-background px-4'>
      <Link href='/' className='text-sm font-semibold tracking-tight text-foreground'>
        Harness
      </Link>
      <div className='mx-auto'>
        <button
          type='button'
          className='flex w-64 items-center gap-2 rounded-md border border-border/60 px-2.5 py-1 text-left transition-colors hover:bg-muted/50'
          aria-label='Open command palette'
        >
          <Search className='h-3 w-3 shrink-0 text-muted-foreground/60' />
          <span className='flex-1 text-xs text-muted-foreground/60'>Search…</span>
          <kbd className='rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60'>⌘K</kbd>
        </button>
      </div>
      <UserMenu name={name} />
    </header>
  );
};
