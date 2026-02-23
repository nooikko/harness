// Usage summary cards — displays overview metrics as a card grid

import { Activity, Coins, FileInput, FileOutput } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from 'ui';
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
        <Card key={card.label} data-testid={`card-${card.label}`}>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{card.label}</CardTitle>
            <card.icon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent className='flex flex-col gap-1'>
            <p className='text-2xl font-bold'>{card.value}</p>
            <p className='text-xs text-muted-foreground'>{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
