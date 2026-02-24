// Token usage dashboard — shows usage overview, cost breakdowns, and budget warnings

import type { Metadata } from 'next';
import { CostOverTimeChart } from './_components/cost-over-time-chart';
import { TokensOverTimeChart } from './_components/tokens-over-time-chart';
import { UsageByModelTable } from './_components/usage-by-model-table';
import { UsageSummarySection } from './_components/usage-summary-section';

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
    <div className='mx-auto max-w-6xl flex-1 space-y-6 overflow-auto p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Token Usage</h1>
        <p className='mt-1 text-sm text-muted-foreground'>Monitor token consumption, costs, and usage patterns across agent runs.</p>
      </div>

      <UsageSummarySection />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <div className='space-y-6'>
          <TokensOverTimeChart />
          <CostOverTimeChart />
        </div>
        <UsageByModelTable />
      </div>
    </div>
  );
};

export default UsagePage;
