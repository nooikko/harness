'use client';

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@harness/ui';
import { Bot, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLinksComponent = () => React.ReactNode;

export const NavLinks: NavLinksComponent = () => {
  const pathname = usePathname();
  const isProjectsActive = pathname === '/chat/projects' || pathname.startsWith('/chat/projects/');
  const isAgentsActive = pathname === '/agents' || pathname.startsWith('/agents/');

  return (
    <SidebarGroup className='py-0'>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isProjectsActive} className='gap-2'>
            <Link href='/chat/projects'>
              <FolderOpen className='h-4 w-4' />
              <span>Projects</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
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
