// Async server component that fetches usage summary and renders budget + cards

import { prisma } from 'database';
import { Suspense } from 'react';
import { Skeleton } from 'ui';
import { BudgetWarning } from './budget-warning';
import { UsageSummaryCards } from './usage-summary-cards';

export type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  totalRuns: number;
};

/**
 * Async server component: fetches usage summary, renders BudgetWarning + UsageSummaryCards.
 * Not exported — use UsageSummarySection which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use UsageSummarySection. */
export const UsageSummarySectionInternal = async () => {
  const [inputResult, outputResult, costResult, runCount] = await Promise.all([
    prisma.metric.aggregate({
      where: { name: 'token.input' },
      _sum: { value: true },
    }),
    prisma.metric.aggregate({
      where: { name: 'token.output' },
      _sum: { value: true },
    }),
    prisma.metric.aggregate({
      where: { name: 'token.cost' },
      _sum: { value: true },
    }),
    prisma.metric.count({
      where: { name: 'token.total' },
    }),
  ]);

  const totalInputTokens = inputResult._sum.value ?? 0;
  const totalOutputTokens = outputResult._sum.value ?? 0;

  const summary: UsageSummary = {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: costResult._sum.value ?? 0,
    totalRuns: runCount,
  };

  const budgetEnv = process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  const budgetUsd = budgetEnv ? Number(budgetEnv) : undefined;

  return (
    <>
      <BudgetWarning currentCost={summary.totalCost} budgetUsd={budgetUsd} />
      <UsageSummaryCards summary={summary} />
    </>
  );
};

const UsageSummarySkeleton = () => (
  <div className='space-y-6'>
    <Skeleton className='h-24 w-full' />
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={`summary-skeleton-${i}`} className='h-28 w-full' />
      ))}
    </div>
  </div>
);

/**
 * Drop-in usage summary with built-in Suspense boundary.
 * Streams budget warning + metric cards as soon as data is ready; shows a skeleton until then.
 */
export const UsageSummarySection = () => (
  <Suspense fallback={<UsageSummarySkeleton />}>
    <UsageSummarySectionInternal />
  </Suspense>
);
