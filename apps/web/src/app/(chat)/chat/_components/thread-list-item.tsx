'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SidebarMenuButton } from '@harness/ui';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DeleteThreadModal } from './delete-thread-modal';
import { ManageThreadModal } from './manage-thread-modal';

type ProjectOption = {
  id: string;
  name: string;
};

type ThreadListItemProps = {
  thread: {
    id: string;
    name: string | null;
    source: string;
    sourceId: string;
    kind: string;
    model: string | null;
    effort: string | null;
    customInstructions: string | null;
    projectId: string | null;
    lastActivity: Date;
  };
  isActive: boolean;
  projects: ProjectOption[];
};

type ThreadListItemComponent = (props: ThreadListItemProps) => React.ReactNode;

export const ThreadListItem: ThreadListItemComponent = ({ thread, isActive, projects }) => {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <>
      <div className='group relative flex w-full items-center'>
        <SidebarMenuButton asChild isActive={isActive} size='sm' className='pr-8'>
          <Link href={`/chat/${thread.id}`}>
            <span className='truncate -tracking-[0.01em]'>{displayName}</span>
          </Link>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='absolute right-1 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-sidebar-accent group-hover:opacity-100 focus-visible:opacity-100'
              aria-label='Thread options'
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className='h-4 w-4' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side='right' align='start' className='w-40'>
            <DropdownMenuItem onSelect={() => setIsManageOpen(true)}>Manage</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsDeleteOpen(true)} className='text-destructive focus:text-destructive'>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ManageThreadModal
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
        threadId={thread.id}
        currentName={thread.name}
        currentModel={thread.model}
        currentEffort={thread.effort}
        currentInstructions={thread.customInstructions ?? null}
        currentProjectId={thread.projectId}
        projects={projects}
      />

      <DeleteThreadModal open={isDeleteOpen} onOpenChange={setIsDeleteOpen} threadId={thread.id} threadName={thread.name} />
    </>
  );
};
