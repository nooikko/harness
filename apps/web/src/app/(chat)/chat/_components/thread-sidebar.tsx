import { Sidebar, SidebarContent, SidebarFooter, Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { UserProfileMenu } from './user-profile-menu';

/** @internal Exported for testing only — consumers should use ThreadSidebar. */
export const ThreadSidebarInternal = () => {
  return (
    <Sidebar className='w-64 border-r border-border'>
      <SidebarContent />
      <SidebarFooter>
        <UserProfileMenu />
      </SidebarFooter>
    </Sidebar>
  );
};

const ThreadSidebarSkeleton = () => (
  <Sidebar className='w-64 border-r border-border'>
    <SidebarContent />
    <SidebarFooter>
      <Skeleton className='h-12 w-full rounded-lg' />
    </SidebarFooter>
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
