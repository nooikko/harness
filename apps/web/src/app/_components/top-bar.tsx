'use client';

import Link from 'next/link';
import { NavLink } from './nav-link';

type TopBarComponent = () => React.ReactNode;

export const TopBar: TopBarComponent = () => (
  <header className='flex h-14 shrink-0 items-center border-b border-border bg-background px-6'>
    <Link href='/' className='mr-8 text-lg font-semibold tracking-tight text-foreground'>
      Harness
    </Link>
    <nav className='flex items-center gap-1' aria-label='Main navigation'>
      <NavLink href='/'>Chat</NavLink>
      <NavLink href='/usage'>Usage</NavLink>
      <NavLink href='/admin'>Admin</NavLink>
    </nav>
  </header>
);
