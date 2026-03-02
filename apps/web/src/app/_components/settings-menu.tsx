'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@harness/ui';
import { BarChart2, Settings } from 'lucide-react';
import Link from 'next/link';

type SettingsMenuComponent = () => React.ReactNode;

export const SettingsMenu: SettingsMenuComponent = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type='button'
        className='flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        aria-label='Settings'
      >
        <Settings className='h-4 w-4' />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className='w-48 rounded-lg' align='end' sideOffset={8}>
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href='/admin'>
            <Settings className='h-4 w-4' />
            Admin
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href='/usage'>
            <BarChart2 className='h-4 w-4' />
            Usage
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </DropdownMenuContent>
  </DropdownMenu>
);
