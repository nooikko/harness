'use client';

import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@harness/ui';
import { Bot } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavProductsComponent = () => React.ReactNode;

export const NavProducts: NavProductsComponent = () => {
  const pathname = usePathname();
  const isAgentsActive = pathname === '/agents' || pathname.startsWith('/agents/');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Products</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isAgentsActive} className='gap-2'>
            <Link href='/agents'>
              <Bot className='h-4 w-4' />
              <span>Agents</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};
