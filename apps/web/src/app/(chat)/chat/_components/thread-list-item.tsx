'use client';

import type { Thread } from '@harness/database';
import { cn } from '@harness/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatRelativeTime } from '../_helpers/format-relative-time';
import { ThreadKindIcon } from './thread-kind-icon';

type ThreadListItemProps = {
  thread: Thread;
};

type ThreadListItemComponent = (props: ThreadListItemProps) => React.ReactNode;

/**
 * Renders a single thread entry in the sidebar thread list.
 * Client Component to read the current pathname for active-state highlighting.
 */
export const ThreadListItem: ThreadListItemComponent = ({ thread }) => {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${thread.id}`;
  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <Link
      href={`/chat/${thread.id}`}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground',
      )}
    >
      <ThreadKindIcon kind={thread.kind} className='h-4 w-4 shrink-0 text-muted-foreground' />
      <div className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate font-medium'>{displayName}</span>
        <span className='text-xs text-muted-foreground'>{formatRelativeTime(thread.lastActivity)}</span>
      </div>
    </Link>
  );
};
