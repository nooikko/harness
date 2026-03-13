'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@harness/ui';
import { BarChart2, Settings, User } from 'lucide-react';
import Link from 'next/link';

type UserMenuProps = {
  name: string;
};

type UserMenuComponent = (props: UserMenuProps) => React.ReactNode;

export const UserMenu: UserMenuComponent = ({ name }) => {
  const initial = name.charAt(0).toUpperCase();
  const isDefault = name === 'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type='button'
          className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          aria-label='User menu'
        >
          {isDefault ? <User className='h-4 w-4' /> : initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56 rounded-lg' align='end' sideOffset={8}>
        <DropdownMenuLabel className='font-normal'>
          <span className='text-sm font-medium'>{isDefault ? 'Set up your profile' : name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href='/admin/profile'>
              <User className='h-4 w-4' />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/admin'>
              <Settings className='h-4 w-4' />
              Admin
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/admin/usage'>
              <BarChart2 className='h-4 w-4' />
              Usage
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
