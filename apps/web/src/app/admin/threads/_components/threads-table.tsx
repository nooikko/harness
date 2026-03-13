// Threads table — columnar view with status dots, relative time, and hover-reveal row actions

import { prisma } from '@harness/database';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '../../_components/relative-time';
import { RowMenu } from '../../_components/row-menu';
import { StatusDot } from '../../_components/status-dot';
import { archiveThread } from '../_actions/archive-thread';

/** @internal Exported for testing only — consumers should use ThreadsTable. */
export const ThreadsTableInternal = async () => {
  const threads = await prisma.thread.findMany({
    orderBy: { lastActivity: 'desc' },
    take: 50,
    include: {
      agent: { select: { name: true } },
      project: { select: { name: true } },
      _count: {
        select: { messages: { where: { kind: 'text' } } },
      },
    },
  });

  if (threads.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <MessageSquare className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No threads yet</p>
          <p className='text-xs text-muted-foreground/60'>Threads appear when users start conversations.</p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Kind</TableHead>
          <TableHead className='text-right'>Messages</TableHead>
          <TableHead>Last Active</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='w-11' />
        </TableRow>
      </TableHeader>
      <TableBody>
        {threads.map((thread) => {
          const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;
          const archiveAction = archiveThread.bind(null, thread.id);

          return (
            <TableRow key={thread.id} className='group/row'>
              <TableCell variant='primary'>
                <Link href={`/chat/${thread.id}`} className='hover:underline'>
                  {displayName}
                </Link>
              </TableCell>
              <TableCell>{thread.agent?.name ?? '\u2014'}</TableCell>
              <TableCell>
                <span className='inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium'>{thread.source}</span>
              </TableCell>
              <TableCell>{thread.kind}</TableCell>
              <TableCell className='text-right tabular-nums'>{thread._count.messages}</TableCell>
              <TableCell>
                <RelativeTime date={thread.lastActivity} />
              </TableCell>
              <TableCell>
                <StatusDot status={thread.status} />
              </TableCell>
              <TableCell>
                <RowMenu
                  actions={[
                    { label: 'View', icon: 'external-link', href: `/chat/${thread.id}` },
                    ...(thread.status !== 'archived'
                      ? [
                          {
                            label: 'Archive',
                            icon: 'archive',
                            destructive: true as const,
                            onClick: async () => {
                              'use server';
                              await archiveAction();
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const ThreadsTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-20' />
      ))}
    </div>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-3'>
        <Skeleton className='h-3 w-40' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-12' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-3 w-8' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-3 w-12' />
      </div>
    ))}
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
