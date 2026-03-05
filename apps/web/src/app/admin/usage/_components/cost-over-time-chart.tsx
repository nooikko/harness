import { prisma } from '@harness/database';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { formatCost } from '../_helpers/format-cost';

type DailyCost = {
  date: string;
  totalCost: number;
};

type CostOverTimeChartComponent = () => Promise<React.ReactNode>;

/**
 * Async server component that fetches daily cost totals and renders a bar chart.
 * Owns its own data — inlines the Prisma query for token.cost metrics.
 * Not exported — use CostOverTimeChart which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use CostOverTimeChart. */
export const CostOverTimeChartInternal: CostOverTimeChartComponent = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const metrics = await prisma.metric.findMany({
    where: {
      name: 'token.cost',
      createdAt: { gte: since },
    },
    select: {
      value: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap = new Map<string, number>();
  for (const metric of metrics) {
    const dateKey = metric.createdAt.toISOString().substring(0, 10);
    dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + metric.value);
  }

  const data: DailyCost[] = Array.from(dailyMap.entries())
    .map(([date, totalCost]) => ({ date, totalCost }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No cost data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.totalCost), 0.001);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {data.map((day) => (
            <div key={day.date} className='flex items-center gap-3'>
              <span className='w-20 shrink-0 text-xs text-muted-foreground'>{day.date.slice(5)}</span>
              <div className='flex-1'>
                <meter
                  className='h-6 w-full appearance-none rounded bg-primary/20 [&::-webkit-meter-bar]:rounded [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:rounded [&::-webkit-meter-optimum-value]:bg-primary/40'
                  value={day.totalCost}
                  min={0}
                  max={maxCost}
                  aria-label={`${day.date}: ${formatCost(day.totalCost)}`}
                />
              </div>
              <span className='w-16 shrink-0 text-right text-xs'>{formatCost(day.totalCost)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

type CostOverTimeChartSkeletonComponent = () => React.ReactNode;

const CostOverTimeChartSkeleton: CostOverTimeChartSkeletonComponent = () => <Skeleton className='h-80 w-full' />;

type CostOverTimeChartExportComponent = () => React.ReactNode;

/**
 * Drop-in cost chart with built-in Suspense boundary.
 * Streams the async chart as soon as data is ready; shows a skeleton until then.
 */
export const CostOverTimeChart: CostOverTimeChartExportComponent = () => (
  <Suspense fallback={<CostOverTimeChartSkeleton />}>
    <CostOverTimeChartInternal />
  </Suspense>
);
