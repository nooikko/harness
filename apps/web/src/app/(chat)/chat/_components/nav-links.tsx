'use client';

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@harness/ui';
import { BookOpen, Bot, CalendarDays, CheckSquare, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLinksComponent = () => React.ReactNode;

export const NavLinks: NavLinksComponent = () => {
  const pathname = usePathname();
  const isProjectsActive = pathname === '/chat/projects' || pathname.startsWith('/chat/projects/');
  const isTasksActive = pathname === '/tasks' || pathname.startsWith('/tasks/');
  const isCalendarActive = pathname === '/calendar' || pathname.startsWith('/calendar/');
  const isStoriesActive = pathname === '/stories' || pathname.startsWith('/stories/');
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
          <SidebarMenuButton asChild isActive={isCalendarActive} className='gap-2'>
            <Link href='/calendar'>
              <CalendarDays className='h-4 w-4' />
              <span>Calendar</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isTasksActive} className='gap-2'>
            <Link href='/tasks'>
              <CheckSquare className='h-4 w-4' />
              <span>Tasks</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isStoriesActive} className='gap-2'>
            <Link href='/stories'>
              <BookOpen className='h-4 w-4' />
              <span>Stories</span>
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
