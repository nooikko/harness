// Usage by model table — displays per-model token and cost breakdown

import { prisma } from '@harness/database';
import { Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { Suspense } from 'react';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

type ModelUsageRow = {
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  runCount: number;
};

type MetricTags = {
  model?: string;
  [key: string]: unknown;
};

/**
 * Async server component that fetches per-model usage from Metric records and renders a table.
 * Queries token.input, token.output, and token.cost metrics; aggregates by model from tags.
 * Not exported — use UsageByModelTable which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use UsageByModelTable. */
export const UsageByModelTableInternal = async () => {
  const [inputMetrics, outputMetrics, costMetrics] = await Promise.all([
    prisma.metric.findMany({
      where: { name: 'token.input' },
      select: { value: true, tags: true },
    }),
    prisma.metric.findMany({
      where: { name: 'token.output' },
      select: { value: true, tags: true },
    }),
    prisma.metric.findMany({
      where: { name: 'token.cost' },
      select: { value: true, tags: true },
    }),
  ]);

  const inputByModel = new Map<string, number>();
  const outputByModel = new Map<string, number>();
  const costByModel = new Map<string, number>();
  const runsByModel = new Map<string, number>();

  for (const metric of inputMetrics) {
    const tags = metric.tags as MetricTags | null;
    const model = tags?.model ?? 'unknown';
    inputByModel.set(model, (inputByModel.get(model) ?? 0) + metric.value);
  }

  for (const metric of outputMetrics) {
    const tags = metric.tags as MetricTags | null;
    const model = tags?.model ?? 'unknown';
    outputByModel.set(model, (outputByModel.get(model) ?? 0) + metric.value);
  }

  for (const metric of costMetrics) {
    const tags = metric.tags as MetricTags | null;
    const model = tags?.model ?? 'unknown';
    costByModel.set(model, (costByModel.get(model) ?? 0) + metric.value);
    runsByModel.set(model, (runsByModel.get(model) ?? 0) + 1);
  }

  const allModels = new Set([...inputByModel.keys(), ...outputByModel.keys(), ...costByModel.keys()]);

  const models: ModelUsageRow[] = Array.from(allModels)
    .map((model) => ({
      model,
      totalInputTokens: inputByModel.get(model) ?? 0,
      totalOutputTokens: outputByModel.get(model) ?? 0,
      totalCost: costByModel.get(model) ?? 0,
      runCount: runsByModel.get(model) ?? 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

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
