import { prisma } from 'database';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from 'ui';
import { formatTokenCount } from '../_helpers/format-cost';

type DailyTokens = {
  date: string;
  totalTokens: number;
};

/**
 * Async server component that fetches daily token totals and renders a bar chart.
 * Owns its own data — inlines the Prisma query for token.total metrics.
 * Not exported — use TokensOverTimeChart which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use TokensOverTimeChart. */
export const TokensOverTimeChartInternal = async () => {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const metrics = await prisma.metric.findMany({
    where: {
      name: 'token.total',
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

  const data: DailyTokens[] = Array.from(dailyMap.entries())
    .map(([date, totalTokens]) => ({ date, totalTokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tokens Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No token data for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {data.map((day) => (
            <div key={day.date} className='flex items-center gap-3'>
              <span className='w-20 shrink-0 text-xs text-muted-foreground'>{day.date.slice(5)}</span>
              <div className='flex-1'>
                <meter
                  className='h-6 w-full appearance-none rounded bg-primary/20 [&::-webkit-meter-bar]:rounded [&::-webkit-meter-bar]:bg-muted [&::-webkit-meter-optimum-value]:rounded [&::-webkit-meter-optimum-value]:bg-primary/40'
                  value={day.totalTokens}
                  min={0}
                  max={maxTokens}
                  aria-label={`${day.date}: ${formatTokenCount(day.totalTokens)} tokens`}
                />
              </div>
              <span className='w-16 shrink-0 text-right text-xs'>{formatTokenCount(day.totalTokens)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const TokensOverTimeChartSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in token usage chart with built-in Suspense boundary.
 * Streams the async chart as soon as data is ready; shows a skeleton until then.
 */
export const TokensOverTimeChart = () => (
  <Suspense fallback={<TokensOverTimeChartSkeleton />}>
    <TokensOverTimeChartInternal />
  </Suspense>
);
