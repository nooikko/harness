'use client';

import type { Thread } from '@harness/database';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@harness/ui';
import { usePathname } from 'next/navigation';
import { ThreadListItem } from './thread-list-item';

type ProjectOption = {
  id: string;
  name: string;
};

type NavChatsProps = {
  threads: Thread[];
  projects: ProjectOption[];
};

type NavChatsComponent = (props: NavChatsProps) => React.ReactNode;

export const NavChats: NavChatsComponent = ({ threads, projects }) => {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recents</SidebarGroupLabel>
      <SidebarMenu>
        {threads.map((thread) => {
          const href = `/chat/${thread.id}`;
          const isActive = pathname === href;
          return (
            <SidebarMenuItem key={thread.id}>
              <ThreadListItem
                thread={{
                  id: thread.id,
                  name: thread.name,
                  source: thread.source,
                  sourceId: thread.sourceId,
                  kind: thread.kind,
                  model: thread.model,
                  customInstructions: thread.customInstructions,
                  projectId: thread.projectId,
                  lastActivity: thread.lastActivity,
                }}
                isActive={isActive}
                projects={projects}
              />
            </SidebarMenuItem>
          );
        })}
        {threads.length === 0 && (
          <SidebarMenuItem>
            <span className='px-3 py-2 text-xs text-sidebar-foreground/40'>No chats yet</span>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
};
