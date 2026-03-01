// Usage by model table — displays per-model token and cost breakdown

import { prisma } from '@harness/database';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { Suspense } from 'react';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

/**
 * Async server component that fetches per-model usage and renders a table.
 * Not exported — use UsageByModelTable which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use UsageByModelTable. */
export const UsageByModelTableInternal = async () => {
  const results = await prisma.agentRun.groupBy({
    by: ['model'],
    _sum: {
      inputTokens: true,
      outputTokens: true,
      costEstimate: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        costEstimate: 'desc',
      },
    },
  });

  const models = results.map((row) => ({
    model: row.model,
    totalInputTokens: row._sum.inputTokens ?? 0,
    totalOutputTokens: row._sum.outputTokens ?? 0,
    totalCost: row._sum.costEstimate ?? 0,
    runCount: row._count,
  }));

  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Model</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No usage data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Model</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className='text-right'>Runs</TableHead>
              <TableHead className='text-right'>Input Tokens</TableHead>
              <TableHead className='text-right'>Output Tokens</TableHead>
              <TableHead className='text-right'>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.model}>
                <TableCell className='font-mono text-xs'>{model.model}</TableCell>
                <TableCell className='text-right'>{model.runCount}</TableCell>
                <TableCell className='text-right'>{formatTokenCount(model.totalInputTokens)}</TableCell>
                <TableCell className='text-right'>{formatTokenCount(model.totalOutputTokens)}</TableCell>
                <TableCell className='text-right font-medium'>{formatCost(model.totalCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const UsageByModelTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in model usage table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const UsageByModelTable = () => (
  <Suspense fallback={<UsageByModelTableSkeleton />}>
    <UsageByModelTableInternal />
  </Suspense>
);
