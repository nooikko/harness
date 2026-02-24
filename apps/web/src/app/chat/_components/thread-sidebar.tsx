import { prisma } from 'database';
import { MessageSquarePlus } from 'lucide-react';
import { Suspense } from 'react';
import { ScrollArea, Skeleton } from 'ui';
import { sortThreads } from '../_helpers/sort-threads';
import { ThreadListItem } from './thread-list-item';

/**
 * Async server component that fetches threads and renders the sidebar.
 * Primary thread is pinned to top. Each ThreadListItem is a Client Component
 * for active-state highlighting.
 * Not exported — use ThreadSidebar which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use ThreadSidebar. */
export const ThreadSidebarInternal = async () => {
  const threads = await prisma.thread.findMany({
    where: { status: { not: 'archived' } },
    orderBy: { lastActivity: 'desc' },
  });
  const sorted = sortThreads(threads);

  return (
    <aside className='flex h-full w-72 flex-col border-r border-border bg-card'>
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <h2 className='text-sm font-semibold'>Threads</h2>
        <span role='img' title='New chat' aria-label='New chat'>
          <MessageSquarePlus className='h-4 w-4 text-muted-foreground' />
        </span>
      </div>
      <ScrollArea className='flex-1'>
        <nav className='p-2' aria-label='Thread list'>
          {sorted.length === 0 ? (
            <p className='px-3 py-4 text-center text-sm text-muted-foreground'>No threads yet</p>
          ) : (
            <ul className='flex flex-col gap-0.5'>
              {sorted.map((thread) => (
                <li key={thread.id}>
                  <ThreadListItem thread={thread} />
                </li>
              ))}
            </ul>
          )}
        </nav>
      </ScrollArea>
    </aside>
  );
};

const ThreadSidebarSkeleton = () => (
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

/**
 * Drop-in thread sidebar with built-in Suspense boundary.
 * Streams the async sidebar as soon as data is ready; shows a skeleton until then.
 */
export const ThreadSidebar = () => (
  <Suspense fallback={<ThreadSidebarSkeleton />}>
    <ThreadSidebarInternal />
  </Suspense>
);
