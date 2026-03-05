import { prisma } from '@harness/database';
import { Sidebar, SidebarContent, SidebarSeparator, Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { sortThreads } from '../_helpers/sort-threads';
import { NavChats } from './nav-chats';
import { NavLinks } from './nav-links';
import { NavProjects } from './nav-projects';
import { SidebarNewChat } from './sidebar-new-chat';

/** @internal Exported for testing only — consumers should use ThreadSidebar. */
export const ThreadSidebarInternal = async () => {
  const [threads, projects] = await Promise.all([
    prisma.thread.findMany({
      where: { kind: { not: 'task' }, projectId: null },
      orderBy: { lastActivity: 'desc' },
      take: 50,
    }),
    prisma.project.findMany({
      include: {
        threads: {
          where: { kind: { not: 'task' } },
          orderBy: { lastActivity: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const sorted = sortThreads(threads);

  return (
    <Sidebar className='w-64 border-r border-border'>
      <SidebarContent>
        <SidebarNewChat />
        <NavLinks />
        {projects.length > 0 && (
          <>
            <SidebarSeparator />
            <NavProjects projects={projects} />
          </>
        )}
        <SidebarSeparator />
        <NavChats threads={sorted} />
      </SidebarContent>
    </Sidebar>
  );
};

const ThreadSidebarSkeleton = () => (
  <Sidebar className='w-64 border-r border-border'>
    <SidebarContent>
      <div className='flex flex-col gap-1 p-2'>
        <Skeleton className='h-8 w-full rounded-md' />
        {['a', 'b', 'c', 'd', 'e'].map((k) => (
          <Skeleton key={k} className='h-7 w-full rounded-md' />
        ))}
      </div>
    </SidebarContent>
  </Sidebar>
);

/**
 * Drop-in sidebar with built-in Suspense boundary.
 */
export const ThreadSidebar = () => (
  <Suspense fallback={<ThreadSidebarSkeleton />}>
    <ThreadSidebarInternal />
  </Suspense>
);
