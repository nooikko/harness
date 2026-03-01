'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@harness/ui';
import { BarChart2, ChevronsUpDown, Settings } from 'lucide-react';
import Link from 'next/link';

type UserProfileMenuComponent = () => React.ReactNode;

export const UserProfileMenu: UserProfileMenuComponent = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size='lg' className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'>
            <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-[11px] font-bold text-background'>H</div>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-medium'>Harness</span>
              <span className='truncate text-xs text-muted-foreground'>Admin</span>
            </div>
            <ChevronsUpDown className='ml-auto size-4' />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-(--radix-dropdown-menu-trigger-width) min-w-52 rounded-lg' side='right' align='end' sideOffset={4}>
          <DropdownMenuLabel className='p-0 font-normal'>
            <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-[11px] font-bold text-background'>
                H
              </div>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>Harness</span>
                <span className='truncate text-xs text-muted-foreground'>Admin</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href='/admin' className='flex items-center gap-2'>
                <Settings className='h-4 w-4' />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/usage' className='flex items-center gap-2'>
                <BarChart2 className='h-4 w-4' />
                Usage
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
);
