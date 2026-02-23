// Usage by model table — displays per-model token and cost breakdown

import type { ModelUsage } from '../_helpers/fetch-usage-by-model';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

type UsageByModelTableProps = {
  models: ModelUsage[];
};

type UsageByModelTableComponent = (props: UsageByModelTableProps) => React.ReactNode;

export const UsageByModelTable: UsageByModelTableComponent = ({ models }) => {
  if (models.length === 0) {
    return (
      <div className='rounded-lg border bg-card p-6'>
        <h3 className='text-lg font-semibold'>Usage by Model</h3>
        <p className='mt-2 text-sm text-muted-foreground'>No usage data available yet.</p>
      </div>
    );
  }

  return (
    <div className='rounded-lg border bg-card p-6'>
      <h3 className='text-lg font-semibold'>Usage by Model</h3>
      <div className='mt-4 overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b text-left text-muted-foreground'>
              <th className='pb-2 font-medium'>Model</th>
              <th className='pb-2 text-right font-medium'>Runs</th>
              <th className='pb-2 text-right font-medium'>Input Tokens</th>
              <th className='pb-2 text-right font-medium'>Output Tokens</th>
              <th className='pb-2 text-right font-medium'>Cost</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.model} className='border-b last:border-0'>
                <td className='py-3 font-mono text-xs'>{model.model}</td>
                <td className='py-3 text-right'>{model.runCount}</td>
                <td className='py-3 text-right'>{formatTokenCount(model.totalInputTokens)}</td>
                <td className='py-3 text-right'>{formatTokenCount(model.totalOutputTokens)}</td>
                <td className='py-3 text-right font-medium'>{formatCost(model.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
