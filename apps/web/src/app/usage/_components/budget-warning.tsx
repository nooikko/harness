// Budget warning — displays a warning when token usage approaches or exceeds the budget threshold

import { Alert, AlertTitle, Card, CardContent, Progress } from '@harness/ui';
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
      <Card data-testid='budget-status'>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Monthly Budget</span>
            <span>
              {formatCost(currentCost)} / {formatCost(budget)}
            </span>
          </div>
          <div className='mt-2'>
            <Progress value={Math.min(usagePercent, 100)} />
          </div>
          <p className='mt-1 text-xs text-muted-foreground'>{usagePercent.toFixed(1)}% of budget used</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Alert
      variant={isCritical ? 'destructive' : 'default'}
      className={!isCritical ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : undefined}
      data-testid='budget-warning'
    >
      <AlertTriangle className='h-4 w-4' />
      <AlertTitle>{isCritical ? 'Budget exceeded!' : 'Approaching budget limit'}</AlertTitle>
      <div className='mt-4 flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>Monthly Budget</span>
        <span className='font-medium'>
          {formatCost(currentCost)} / {formatCost(budget)}
        </span>
      </div>
      <div className='mt-3'>
        <Progress value={Math.min(usagePercent, 100)} className={!isCritical ? '[&>[data-slot=progress-indicator]]:bg-yellow-500' : undefined} />
      </div>
      <p className='mt-1 text-xs text-muted-foreground'>{usagePercent.toFixed(1)}% of budget used</p>
    </Alert>
  );
};
