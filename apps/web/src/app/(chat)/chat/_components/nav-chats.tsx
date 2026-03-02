'use client';

import type { Thread } from '@harness/database';
import { SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@harness/ui';
import { usePathname } from 'next/navigation';
import { NewThreadButton } from './new-thread-button';
import { ThreadListItem } from './thread-list-item';

type NavChatsProps = {
  threads: Thread[];
};

type NavChatsComponent = (props: NavChatsProps) => React.ReactNode;

export const NavChats: NavChatsComponent = ({ threads }) => {
  const pathname = usePathname();

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <NewThreadButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Recents</SidebarGroupLabel>
        <SidebarMenu>
          {threads.map((thread) => {
            const href = `/chat/${thread.id}`;
            const isActive = pathname === href;
            return (
              <SidebarMenuItem key={thread.id}>
                <ThreadListItem thread={thread} isActive={isActive} />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
};
