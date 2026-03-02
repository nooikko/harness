'use client';

import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@harness/ui';
import { MoreHorizontal } from 'lucide-react';

type NavProductsComponent = () => React.ReactNode;

export const NavProducts: NavProductsComponent = () => {
  const { isMobile: _isMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Products</SidebarGroupLabel>
      <SidebarMenu>
        {/* Placeholder — populate with product entries as needed */}
        <SidebarMenuItem>
          <SidebarMenuButton className='text-sidebar-foreground/50'>
            <MoreHorizontal className='text-sidebar-foreground/50' />
            <span>More coming soon</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};
