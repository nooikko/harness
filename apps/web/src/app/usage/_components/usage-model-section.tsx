// Async server component that fetches per-model usage and renders the table

import { Skeleton } from 'ui';
import { fetchUsageByModel } from '../_helpers/fetch-usage-by-model';
import { UsageByModelTable } from './usage-by-model-table';

type UsageModelSectionComponent = () => Promise<React.ReactNode>;

/**
 * Async server component: fetches per-model usage data and renders UsageByModelTable.
 * Meant to be wrapped in a Suspense boundary by the parent page.
 */
export const UsageModelSection: UsageModelSectionComponent = async () => {
  const modelUsage = await fetchUsageByModel();
  return <UsageByModelTable models={modelUsage} />;
};

type UsageModelSkeletonComponent = () => React.ReactNode;

export const UsageModelSkeleton: UsageModelSkeletonComponent = () => <Skeleton className='h-80 w-full' />;
