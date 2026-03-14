'use client';

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@harness/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SidebarNewChatComponent = () => React.ReactNode;

export const SidebarNewChat: SidebarNewChatComponent = () => {
  const pathname = usePathname();
  const isActive = pathname === '/chat/new';

  return (
    <SidebarGroup className='mt-2 py-0'>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive} className='gap-2'>
            <Link href='/chat/new'>
              <Plus className='h-4 w-4' />
              <span>New chat</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};
