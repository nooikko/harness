// Agent runs table — displays model invocations with token and cost data

import { prisma } from '@harness/database';
import {
  Badge,
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
      <Card>
        <CardHeader>
          <CardTitle>Agent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No agent runs found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Input Tokens</TableHead>
              <TableHead className='text-right'>Output Tokens</TableHead>
              <TableHead className='text-right'>Cost</TableHead>
              <TableHead>Thread</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className='font-mono text-xs'>{run.model}</TableCell>
                <TableCell>
                  <Badge variant={getRunStatusVariant(run.status)}>{run.status}</Badge>
                </TableCell>
                <TableCell className='text-right'>{formatTokens(run.inputTokens)}</TableCell>
                <TableCell className='text-right'>{formatTokens(run.outputTokens)}</TableCell>
                <TableCell className='text-right font-mono'>{formatCost(run.costEstimate)}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{run.thread.name ?? run.thread.id.slice(0, 8)}</TableCell>
                <TableCell>{formatDate(run.startedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const AgentRunsTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in agent runs table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const AgentRunsTable = () => (
  <Suspense fallback={<AgentRunsTableSkeleton />}>
    <AgentRunsTableInternal />
  </Suspense>
);
