// Async server component that fetches usage summary and renders budget + cards

import { Skeleton } from 'ui';
import { fetchUsageSummary } from '../_helpers/fetch-usage-summary';
import { BudgetWarning } from './budget-warning';
import { UsageSummaryCards } from './usage-summary-cards';

type UsageSummarySectionComponent = () => Promise<React.ReactNode>;

/**
 * Async server component: fetches usage summary, renders BudgetWarning + UsageSummaryCards.
 * Meant to be wrapped in a Suspense boundary by the parent page.
 */
export const UsageSummarySection: UsageSummarySectionComponent = async () => {
  const summary = await fetchUsageSummary();

  const budgetEnv = process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  const budgetUsd = budgetEnv ? Number(budgetEnv) : undefined;

  return (
    <>
      <BudgetWarning currentCost={summary.totalCost} budgetUsd={budgetUsd} />
      <UsageSummaryCards summary={summary} />
    </>
  );
};

type UsageSummarySkeletonComponent = () => React.ReactNode;

export const UsageSummarySkeleton: UsageSummarySkeletonComponent = () => (
  <div className='space-y-6'>
    <Skeleton className='h-24 w-full' />
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={`summary-skeleton-${i}`} className='h-28 w-full' />
      ))}
    </div>
  </div>
);
