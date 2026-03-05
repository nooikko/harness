'use client';

import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@harness/ui';
import { BarChart3, Calendar, CheckSquare, MessageSquare, Play, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/cron-jobs', label: 'Cron Jobs', icon: Calendar },
  { href: '/admin/plugins', label: 'Plugins', icon: Puzzle },
  { href: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/admin/agent-runs', label: 'Agent Runs', icon: Play },
  { href: '/admin/threads', label: 'Threads', icon: MessageSquare },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
];

type AdminSidebarComponent = () => React.ReactNode;

export const AdminSidebar: AdminSidebarComponent = () => {
  const pathname = usePathname();

  return (
    <Sidebar className='w-64 border-r border-border'>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(href)} className='gap-2'>
                  <Link href={href}>
                    <Icon className='h-4 w-4' />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
