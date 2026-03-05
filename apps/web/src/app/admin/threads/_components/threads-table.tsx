// Threads list — displays all conversation threads with management controls

import { prisma } from '@harness/database';
import { Badge, Button, Skeleton } from '@harness/ui';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { archiveThread } from '../_actions/archive-thread';

type StatusVariant = 'default' | 'secondary' | 'outline';

type GetThreadStatusVariant = (status: string) => StatusVariant;

const getThreadStatusVariant: GetThreadStatusVariant = (status) => {
  switch (status) {
    case 'active':
      return 'default';
    case 'closed':
      return 'secondary';
    default:
      return 'outline';
  }
};

type FormatDate = (date: Date) => string;

const formatDate: FormatDate = (date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** @internal Exported for testing only — consumers should use ThreadsTable. */
export const ThreadsTableInternal = async () => {
  const threads = await prisma.thread.findMany({
    orderBy: { lastActivity: 'desc' },
    take: 50,
    include: {
      _count: {
        select: { messages: { where: { kind: 'text' } } },
      },
    },
  });

  if (threads.length === 0) {
    return (
      <div className='py-12 text-center'>
        <p className='text-sm text-muted-foreground/60'>No threads found.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col'>
      {threads.map((thread, i) => {
        const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;
        return (
          <div key={thread.id}>
            {i > 0 && <div className='mx-1 h-px bg-border/40' />}
            <div className='group flex items-start justify-between gap-4 px-1 py-4'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <div className='flex items-center gap-2.5'>
                  <span className='text-sm font-medium'>{displayName}</span>
                  <Badge variant={getThreadStatusVariant(thread.status)} className='text-[11px]'>
                    {thread.status}
                  </Badge>
                  <Badge variant='outline' className='text-[11px]'>
                    {thread.kind}
                  </Badge>
                </div>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70'>
                  <span>{thread.source}</span>
                  <span className='inline-flex items-center gap-1.5'>
                    <MessageSquare className='h-3 w-3' />
                    {thread._count.messages}
                  </span>
                  <span>{formatDate(thread.lastActivity)}</span>
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                <Button variant='ghost' size='sm' asChild>
                  <Link href={`/chat/${thread.id}`}>View</Link>
                </Button>
                {thread.status !== 'archived' && (
                  <form action={archiveThread.bind(null, thread.id)}>
                    <Button variant='ghost' size='sm' type='submit'>
                      Archive
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ThreadsTableSkeleton = () => (
  <div className='flex flex-col gap-4 py-4'>
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
  </div>
);

/**
 * Drop-in threads list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const ThreadsTable = () => (
  <Suspense fallback={<ThreadsTableSkeleton />}>
    <ThreadsTableInternal />
  </Suspense>
);
