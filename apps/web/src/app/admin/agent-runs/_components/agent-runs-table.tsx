// Agent runs list — displays model invocations with token and cost data

import { prisma } from '@harness/database';
import { Badge, Skeleton } from '@harness/ui';
import { Suspense } from 'react';

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

type GetRunStatusVariant = (status: string) => StatusVariant;

const getRunStatusVariant: GetRunStatusVariant = (status) => {
  switch (status) {
    case 'running':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

type FormatTokens = (count: number) => string;

const formatTokens: FormatTokens = (count) => {
  return count.toLocaleString();
};

type FormatCost = (cost: number) => string;

const formatCost: FormatCost = (cost) => {
  return `$${cost.toFixed(4)}`;
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
      <div className='py-12 text-center'>
        <p className='text-sm text-muted-foreground/60'>No agent runs found.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col'>
      {runs.map((run, i) => (
        <div key={run.id}>
          {i > 0 && <div className='mx-1 h-px bg-border/40' />}
          <div className='flex items-start justify-between gap-4 px-1 py-4'>
            <div className='min-w-0 flex-1 space-y-1.5'>
              <div className='flex items-center gap-2.5'>
                <span className='font-mono text-sm'>{run.model}</span>
                <Badge variant={getRunStatusVariant(run.status)} className='text-[11px]'>
                  {run.status}
                </Badge>
              </div>
              <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70'>
                <span>
                  {formatTokens(run.inputTokens)} in / {formatTokens(run.outputTokens)} out
                </span>
                <span className='font-mono'>{formatCost(run.costEstimate)}</span>
                <span>{run.thread.name ?? run.thread.id.slice(0, 8)}</span>
                <span>{formatDate(run.startedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AgentRunsTableSkeleton = () => (
  <div className='flex flex-col gap-4 py-4'>
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
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
