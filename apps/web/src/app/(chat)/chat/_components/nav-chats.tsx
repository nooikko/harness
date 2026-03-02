'use client';

import type { Thread } from '@harness/database';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@harness/ui';
import { ChevronRight, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewThreadButton } from './new-thread-button';

type NavChatsProps = {
  threads: Thread[];
};

type NavChatsComponent = (props: NavChatsProps) => React.ReactNode;

export const NavChats: NavChatsComponent = ({ threads }) => {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Direct Chats</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen className='group/collapsible'>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <MessageSquare />
                <span>Chats</span>
                <ChevronRight className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {threads.map((thread) => {
                  const label = thread.name ?? thread.kind;
                  const href = `/chat/${thread.id}`;
                  const isActive = pathname === href;
                  return (
                    <SidebarMenuSubItem key={thread.id}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <Link href={href}>
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
                <SidebarMenuSubItem>
                  <div className='flex items-center gap-2 px-2 py-1'>
                    <NewThreadButton />
                    <span className='text-xs text-sidebar-foreground/50'>New chat</span>
                  </div>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
};
