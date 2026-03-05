'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@harness/ui';
import { BarChart2, Settings } from 'lucide-react';
import Link from 'next/link';

type UserProfileMenuComponent = () => React.ReactNode;

export const UserProfileMenu: UserProfileMenuComponent = () => (
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size='lg' className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'>
            <Settings className='size-4' />
            <span className='font-medium'>Settings</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-(--radix-dropdown-menu-trigger-width) min-w-52 rounded-lg' side='right' align='end' sideOffset={4}>
          <DropdownMenuGroup>
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
          <DropdownMenuSeparator />
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
);
