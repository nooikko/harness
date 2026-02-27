import { prisma } from 'database';
import { Inbox, ListTodo, Search } from 'lucide-react';
import { Suspense } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
  Skeleton,
} from 'ui';
import { sortThreads } from '../_helpers/sort-threads';
import { NewThreadButton } from './new-thread-button';
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
    <Sidebar className='w-64 border-r border-border'>
      {/* Cmd+K search bar — visual placeholder, wired up when command palette is built */}
      <SidebarHeader className='p-3 border-b border-border'>
        <button
          type='button'
          className='flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-left transition-colors hover:bg-muted/50'
          aria-label='Open command palette'
        >
          <Search className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
          <span className='flex-1 text-xs text-muted-foreground'>Search…</span>
          <kbd className='rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>⌘K</kbd>
        </button>
      </SidebarHeader>

      {/* CHAT section */}
      <SidebarContent>
        <SidebarGroup className='p-0'>
          <SidebarGroupLabel className='flex items-center justify-between px-4 pt-4 pb-1 h-auto'>
            <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60'>Chat</span>
            <NewThreadButton />
          </SidebarGroupLabel>
          <SidebarMenu className='px-2 pb-2 gap-0.5'>
            {sorted.length === 0 ? (
              <p className='px-3 py-4 text-center text-sm text-muted-foreground'>No threads yet</p>
            ) : (
              sorted.map((thread) => (
                <SidebarMenuItem key={thread.id}>
                  <ThreadListItem thread={thread} />
                </SidebarMenuItem>
              ))
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* INBOX and TASKS — placeholder sections */}
      <SidebarFooter className='p-0'>
        <SidebarSeparator className='mx-0 w-full' />
        <SidebarGroup className='p-0'>
          <SidebarGroupLabel className='flex items-center justify-between px-4 py-3 h-auto'>
            <div className='flex items-center gap-2.5'>
              <Inbox className='h-3.5 w-3.5 text-muted-foreground/50' />
              <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60'>Inbox</span>
            </div>
            <span className='rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/50'>soon</span>
          </SidebarGroupLabel>
        </SidebarGroup>
        <SidebarSeparator className='mx-0 w-full' />
        <SidebarGroup className='p-0'>
          <SidebarGroupLabel className='flex items-center justify-between px-4 py-3 h-auto'>
            <div className='flex items-center gap-2.5'>
              <ListTodo className='h-3.5 w-3.5 text-muted-foreground/50' />
              <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60'>Tasks</span>
            </div>
            <span className='rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/50'>soon</span>
          </SidebarGroupLabel>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
};

const ThreadSidebarSkeleton = () => (
  <Sidebar className='w-64 border-r border-border'>
    <SidebarHeader className='p-3 border-b border-border'>
      <Skeleton className='h-7 w-full rounded-lg' />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup className='p-0'>
        <SidebarGroupLabel className='px-4 pt-4 pb-1 h-auto'>
          <Skeleton className='h-3 w-8' />
        </SidebarGroupLabel>
        <div className='flex flex-col gap-1 px-2'>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={`sidebar-skeleton-${i}`} className='h-12 w-full rounded-md' />
          ))}
        </div>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
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
