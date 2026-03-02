import { prisma } from '@harness/database';
import { Sidebar, SidebarContent, Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { sortThreads } from '../_helpers/sort-threads';
import { NavChats } from './nav-chats';
import { NavProducts } from './nav-products';
import { NavProjects } from './nav-projects';

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
        <NavProjects projects={projects} />
        <NavChats threads={sorted} />
        <NavProducts />
      </SidebarContent>
    </Sidebar>
  );
};

const ThreadSidebarSkeleton = () => (
  <Sidebar className='w-64 border-r border-border'>
    <SidebarContent>
      <div className='flex flex-col gap-1 p-2'>
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
