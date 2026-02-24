'use client';

import { Activity, Clock, MessageSquare, Plug, SquareCheck } from 'lucide-react';
import { Separator } from 'ui';
import { AdminNavLink } from './admin-nav-link';

type AdminSidebarComponent = () => React.ReactNode;

export const AdminSidebar: AdminSidebarComponent = () => {
  return (
    <aside className='flex h-full w-60 shrink-0 flex-col border-r border-border bg-muted/30'>
      <div className='px-4 py-3'>
        <h2 className='text-sm font-semibold text-foreground'>Admin</h2>
      </div>
      <Separator />
      <nav className='flex flex-col gap-1 p-3' aria-label='Admin navigation'>
        <AdminNavLink href='/admin/cron-jobs' icon={Clock} label='Cron Jobs' />
        <AdminNavLink href='/admin/plugins' icon={Plug} label='Plugins' />
        <AdminNavLink href='/admin/tasks' icon={SquareCheck} label='Tasks' />
        <AdminNavLink href='/admin/agent-runs' icon={Activity} label='Agent Runs' />
        <AdminNavLink href='/admin/threads' icon={MessageSquare} label='Threads' />
      </nav>
    </aside>
  );
};
