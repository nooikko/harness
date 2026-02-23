// Usage summary cards — displays overview metrics as a card grid

import { Activity, Coins, FileInput, FileOutput } from 'lucide-react';
import type { UsageSummary } from '../_helpers/fetch-usage-summary';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

type UsageSummaryCardsProps = {
  summary: UsageSummary;
};

type UsageSummaryCardsComponent = (props: UsageSummaryCardsProps) => React.ReactNode;

export const UsageSummaryCards: UsageSummaryCardsComponent = ({ summary }) => {
  const cards = [
    {
      label: 'Total Tokens',
      value: formatTokenCount(summary.totalTokens),
      icon: Activity,
      detail: `${formatTokenCount(summary.totalRuns)} runs`,
    },
    {
      label: 'Input Tokens',
      value: formatTokenCount(summary.totalInputTokens),
      icon: FileInput,
      detail: 'Prompts sent',
    },
    {
      label: 'Output Tokens',
      value: formatTokenCount(summary.totalOutputTokens),
      icon: FileOutput,
      detail: 'Responses received',
    },
    {
      label: 'Total Cost',
      value: formatCost(summary.totalCost),
      icon: Coins,
      detail: 'Estimated USD',
    },
  ];

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => (
        <div key={card.label} className='rounded-lg border bg-card p-6 shadow-sm' data-testid={`card-${card.label}`}>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-medium text-muted-foreground'>{card.label}</p>
            <card.icon className='h-4 w-4 text-muted-foreground' />
          </div>
          <p className='mt-2 text-2xl font-bold'>{card.value}</p>
          <p className='mt-1 text-xs text-muted-foreground'>{card.detail}</p>
        </div>
      ))}
    </div>
  );
};
