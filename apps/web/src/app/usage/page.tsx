// Token usage dashboard — shows usage overview, cost breakdowns, and budget warnings

import type { Metadata } from 'next';
import { BudgetWarning } from './_components/budget-warning';
import { UsageByModelTable } from './_components/usage-by-model-table';
import { UsageOverTimeChart } from './_components/usage-over-time-chart';
import { UsageSummaryCards } from './_components/usage-summary-cards';
import { fetchUsageByModel } from './_helpers/fetch-usage-by-model';
import { fetchUsageOverTime } from './_helpers/fetch-usage-over-time';
import { fetchUsageSummary } from './_helpers/fetch-usage-summary';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Token Usage | Harness Dashboard',
  description: 'Monitor token consumption, costs, and usage patterns across agent runs',
};

type UsagePageComponent = () => Promise<React.ReactNode>;

/**
 * Token usage dashboard page.
 * Server Component that fetches all usage data from Prisma.
 */
const UsagePage: UsagePageComponent = async () => {
  const [summary, modelUsage, dailyUsage] = await Promise.all([fetchUsageSummary(), fetchUsageByModel(), fetchUsageOverTime(30)]);

  const budgetEnv = process.env.NEXT_PUBLIC_TOKEN_BUDGET_USD;
  const budgetUsd = budgetEnv ? Number(budgetEnv) : undefined;

  return (
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Token Usage</h1>
        <p className='mt-1 text-muted-foreground'>Monitor token consumption, costs, and usage patterns across agent runs.</p>
      </div>

      <BudgetWarning currentCost={summary.totalCost} budgetUsd={budgetUsd} />

      <UsageSummaryCards summary={summary} />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <UsageOverTimeChart data={dailyUsage} />
        <UsageByModelTable models={modelUsage} />
      </div>
    </div>
  );
};

export default UsagePage;
