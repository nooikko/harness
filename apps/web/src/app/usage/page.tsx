// Token usage dashboard — shows usage overview, cost breakdowns, and budget warnings

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UsageChartSection, UsageChartSkeleton } from './_components/usage-chart-section';
import { UsageModelSection, UsageModelSkeleton } from './_components/usage-model-section';
import { UsageSummarySection, UsageSummarySkeleton } from './_components/usage-summary-section';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Token Usage | Harness Dashboard',
  description: 'Monitor token consumption, costs, and usage patterns across agent runs',
};

type UsagePageComponent = () => React.ReactNode;

/**
 * Token usage dashboard page.
 * Renders a shell immediately; each data section streams in via Suspense.
 */
const UsagePage: UsagePageComponent = () => {
  return (
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Token Usage</h1>
        <p className='mt-1 text-muted-foreground'>Monitor token consumption, costs, and usage patterns across agent runs.</p>
      </div>

      <Suspense fallback={<UsageSummarySkeleton />}>
        <UsageSummarySection />
      </Suspense>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Suspense fallback={<UsageChartSkeleton />}>
          <UsageChartSection />
        </Suspense>
        <Suspense fallback={<UsageModelSkeleton />}>
          <UsageModelSection />
        </Suspense>
      </div>
    </div>
  );
};

export default UsagePage;
