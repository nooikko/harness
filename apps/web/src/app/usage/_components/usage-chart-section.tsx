// Async server component that fetches daily usage and renders the chart

import { Skeleton } from 'ui';
import { fetchUsageOverTime } from '../_helpers/fetch-usage-over-time';
import { UsageOverTimeChart } from './usage-over-time-chart';

type UsageChartSectionComponent = () => Promise<React.ReactNode>;

/**
 * Async server component: fetches daily usage data and renders UsageOverTimeChart.
 * Meant to be wrapped in a Suspense boundary by the parent page.
 */
export const UsageChartSection: UsageChartSectionComponent = async () => {
  const dailyUsage = await fetchUsageOverTime(30);
  return <UsageOverTimeChart data={dailyUsage} />;
};

type UsageChartSkeletonComponent = () => React.ReactNode;

export const UsageChartSkeleton: UsageChartSkeletonComponent = () => <Skeleton className='h-80 w-full' />;
