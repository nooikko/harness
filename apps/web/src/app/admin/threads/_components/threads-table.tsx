// Threads table — displays all conversation threads with management controls

import { prisma } from '@harness/database';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@harness/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { archiveThread } from '../_actions/archive-thread';

type StatusVariant = 'default' | 'secondary' | 'outline';

type GetThreadStatusVariant = (status: string) => StatusVariant;

const getThreadStatusVariant: GetThreadStatusVariant = (status) => {
  switch (status) {
    case 'open':
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
        select: { messages: true },
      },
    },
  });

  if (threads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Threads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No threads found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Threads</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className='text-right'>Messages</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {threads.map((thread) => {
              const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;
              return (
                <TableRow key={thread.id}>
                  <TableCell className='font-medium'>{displayName}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{thread.kind}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getThreadStatusVariant(thread.status)}>{thread.status}</Badge>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{thread.source}</TableCell>
                  <TableCell className='text-right'>{thread._count.messages}</TableCell>
                  <TableCell>{formatDate(thread.lastActivity)}</TableCell>
                  <TableCell className='flex gap-2'>
                    <Button variant='outline' size='sm' asChild>
                      <Link href={`/chat/${thread.id}`}>View</Link>
                    </Button>
                    {thread.status !== 'archived' && (
                      <form action={archiveThread.bind(null, thread.id)}>
                        <Button variant='outline' size='sm' type='submit'>
                          Archive
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const ThreadsTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in threads table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const ThreadsTable = () => (
  <Suspense fallback={<ThreadsTableSkeleton />}>
    <ThreadsTableInternal />
  </Suspense>
);
