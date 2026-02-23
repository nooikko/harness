// Async server component that fetches threads and renders the sidebar

import { Skeleton } from 'ui';
import { fetchThreads } from '../_helpers/fetch-threads';
import { ThreadSidebar } from './thread-sidebar';

type ThreadSidebarSectionComponent = () => Promise<React.ReactNode>;

/**
 * Async server component: fetches threads and renders ThreadSidebar.
 * Meant to be wrapped in a Suspense boundary by the parent layout.
 */
export const ThreadSidebarSection: ThreadSidebarSectionComponent = async () => {
  const threads = await fetchThreads();
  return <ThreadSidebar threads={threads} />;
};

type ThreadSidebarSkeletonComponent = () => React.ReactNode;

export const ThreadSidebarSkeleton: ThreadSidebarSkeletonComponent = () => (
  <aside className='flex h-full w-72 flex-col border-r border-border bg-card'>
    <div className='flex items-center justify-between border-b border-border px-4 py-3'>
      <Skeleton className='h-4 w-16' />
      <Skeleton className='h-4 w-4' />
    </div>
    <div className='flex flex-col gap-1 p-2'>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={`sidebar-skeleton-${i}`} className='h-12 w-full rounded-md' />
      ))}
    </div>
  </aside>
);
