'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@harness/ui';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertCircle, BarChart3, Calendar, CheckSquare, Link2, MessageSquare, Puzzle, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Account',
    items: [{ href: '/admin/profile', label: 'Profile', icon: User }],
  },
  {
    label: 'Configuration',
    items: [
      { href: '/admin/plugins', label: 'Plugins', icon: Puzzle },
      { href: '/admin/cron-jobs', label: 'Cron Jobs', icon: Calendar },
      { href: '/admin/integrations', label: 'Integrations', icon: Link2 },
    ],
  },
  {
    label: 'Activity',
    items: [
      { href: '/admin/agent-runs', label: 'Agent Runs', icon: Activity },
      { href: '/admin/errors', label: 'Errors', icon: AlertCircle },
      { href: '/admin/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/admin/threads', label: 'Threads', icon: MessageSquare },
    ],
  },
  {
    label: 'Analytics',
    items: [{ href: '/admin/usage', label: 'Usage', icon: BarChart3 }],
  },
];

type AdminSidebarComponent = () => React.ReactNode;

export const AdminSidebar: AdminSidebarComponent = () => {
  const pathname = usePathname();

  return (
    <Sidebar className='w-64 border-r border-border'>
      <SidebarContent>
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            {groupIndex > 0 && <SidebarSeparator className='mx-4' />}
            <SidebarGroup>
              <SidebarGroupLabel className='text-[10px] uppercase tracking-widest text-muted-foreground/50'>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={isActive} className='relative gap-2'>
                        <Link href={href}>
                          {isActive && <span className='absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-primary' aria-hidden='true' />}
                          <Icon className='h-4 w-4' />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
