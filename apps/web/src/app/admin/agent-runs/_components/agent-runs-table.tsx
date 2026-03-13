// Agent runs table — compact monitoring view with human model names, token counts, and status dots

import { prisma } from '@harness/database';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '../../_components/relative-time';
import { StatusDot } from '../../_components/status-dot';
import { humanizeModelName } from '../../_helpers/humanize-model-name';

type FormatTokens = (count: number) => string;

const formatTokens: FormatTokens = (count) => count.toLocaleString();

type FormatCost = (cost: number) => string;

const formatCost: FormatCost = (cost) => `$${cost.toFixed(4)}`;

type FormatDuration = (start: Date, end: Date | null) => string;

const formatDuration: FormatDuration = (start, end) => {
  if (!end) {
    return '\u2014';
  }
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

/** @internal Exported for testing only — consumers should use AgentRunsTable. */
export const AgentRunsTableInternal = async () => {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: {
      thread: {
        select: { id: true, name: true },
      },
    },
  });

  if (runs.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <Activity className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No agent runs yet</p>
          <p className='text-xs text-muted-foreground/60'>Runs appear here when agents process messages.</p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Thread</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className='text-right'>Input</TableHead>
          <TableHead className='text-right'>Output</TableHead>
          <TableHead className='text-right'>Cost</TableHead>
          <TableHead className='text-right'>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell variant='primary'>
              <Link href={`/chat/${run.thread.id}`} className='hover:underline'>
                {run.thread.name ?? run.thread.id.slice(0, 8)}
              </Link>
            </TableCell>
            <TableCell>{humanizeModelName(run.model)}</TableCell>
            <TableCell className='text-right tabular-nums'>{formatTokens(run.inputTokens)}</TableCell>
            <TableCell className='text-right tabular-nums'>{formatTokens(run.outputTokens)}</TableCell>
            <TableCell variant='mono' className='text-right'>
              {formatCost(run.costEstimate)}
            </TableCell>
            <TableCell className='text-right tabular-nums'>{formatDuration(run.startedAt, run.completedAt)}</TableCell>
            <TableCell>
              <StatusDot status={run.status} pulse={run.status === 'running'} />
            </TableCell>
            <TableCell>
              <RelativeTime date={run.startedAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const AgentRunsTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-16' />
      ))}
    </div>
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-2.5'>
        <Skeleton className='h-3 w-28' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-12' />
        <Skeleton className='h-3 w-12' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-3 w-10' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-12' />
      </div>
    ))}
  </div>
);

/**
 * Drop-in agent runs list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const AgentRunsTable = () => (
  <Suspense fallback={<AgentRunsTableSkeleton />}>
    <AgentRunsTableInternal />
  </Suspense>
);
