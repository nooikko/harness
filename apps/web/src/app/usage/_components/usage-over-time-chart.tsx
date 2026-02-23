// Usage over time chart — displays daily token usage as a bar chart visualization

import type { DailyUsage } from '../_helpers/fetch-usage-over-time';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

type UsageOverTimeChartProps = {
  data: DailyUsage[];
};

type UsageOverTimeChartComponent = (props: UsageOverTimeChartProps) => React.ReactNode;

/**
 * Renders a simple bar chart of daily token usage.
 * Uses CSS-based bars for simplicity — no chart library dependency.
 */
export const UsageOverTimeChart: UsageOverTimeChartComponent = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className='rounded-lg border bg-card p-6'>
        <h3 className='text-lg font-semibold'>Usage Over Time</h3>
        <p className='mt-2 text-sm text-muted-foreground'>No usage data for this period.</p>
      </div>
    );
  }

  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);

  return (
    <div className='rounded-lg border bg-card p-6'>
      <h3 className='text-lg font-semibold'>Usage Over Time</h3>
      <div className='mt-4 space-y-2'>
        {data.map((day) => {
          return (
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
              <span className='w-16 shrink-0 text-right text-xs text-muted-foreground'>{formatCost(day.totalCost)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
