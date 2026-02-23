// Budget warning — displays a warning when token usage approaches or exceeds the budget threshold

import { AlertTriangle } from 'lucide-react';
import { formatCost } from '../_helpers/format-cost';

/**
 * Default monthly budget threshold in USD.
 * Can be overridden via the NEXT_PUBLIC_TOKEN_BUDGET_USD env var.
 */
const DEFAULT_BUDGET_USD = 100;

type BudgetWarningProps = {
  currentCost: number;
  budgetUsd?: number;
};

type BudgetWarningComponent = (props: BudgetWarningProps) => React.ReactNode;

export const BudgetWarning: BudgetWarningComponent = ({ currentCost, budgetUsd }) => {
  const budget = budgetUsd ?? DEFAULT_BUDGET_USD;
  const usagePercent = budget > 0 ? (currentCost / budget) * 100 : 0;
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 100;

  if (!isWarning) {
    return (
      <div className='rounded-lg border bg-card p-4' data-testid='budget-status'>
        <div className='flex items-center justify-between text-sm'>
          <span className='text-muted-foreground'>Monthly Budget</span>
          <span>
            {formatCost(currentCost)} / {formatCost(budget)}
          </span>
        </div>
        <div className='mt-2 h-2 rounded-full bg-muted'>
          <div className='h-2 rounded-full bg-primary transition-all' style={{ width: `${Math.min(usagePercent, 100)}%` }} />
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>{usagePercent.toFixed(1)}% of budget used</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 ${isCritical ? 'border-destructive bg-destructive/10' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}`}
      role='alert'
      data-testid='budget-warning'
    >
      <div className='flex items-center gap-2'>
        <AlertTriangle className={`h-4 w-4 ${isCritical ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'}`} />
        <p className={`text-sm font-medium ${isCritical ? 'text-destructive' : 'text-yellow-800 dark:text-yellow-200'}`}>
          {isCritical ? 'Budget exceeded!' : 'Approaching budget limit'}
        </p>
      </div>
      <div className='mt-2 flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Monthly Budget</span>
        <span className='font-medium'>
          {formatCost(currentCost)} / {formatCost(budget)}
        </span>
      </div>
      <div className='mt-2 h-2 rounded-full bg-muted'>
        <div
          className={`h-2 rounded-full transition-all ${isCritical ? 'bg-destructive' : 'bg-yellow-500'}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <p className='mt-1 text-xs text-muted-foreground'>{usagePercent.toFixed(1)}% of budget used</p>
    </div>
  );
};
