// Usage by model table — displays per-model token and cost breakdown

import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'ui';
import type { ModelUsage } from '../_helpers/fetch-usage-by-model';
import { formatCost, formatTokenCount } from '../_helpers/format-cost';

type UsageByModelTableProps = {
  models: ModelUsage[];
};

type UsageByModelTableComponent = (props: UsageByModelTableProps) => React.ReactNode;

export const UsageByModelTable: UsageByModelTableComponent = ({ models }) => {
  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage by Model</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No usage data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Model</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead className='text-right'>Runs</TableHead>
              <TableHead className='text-right'>Input Tokens</TableHead>
              <TableHead className='text-right'>Output Tokens</TableHead>
              <TableHead className='text-right'>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.model}>
                <TableCell className='font-mono text-xs'>{model.model}</TableCell>
                <TableCell className='text-right'>{model.runCount}</TableCell>
                <TableCell className='text-right'>{formatTokenCount(model.totalInputTokens)}</TableCell>
                <TableCell className='text-right'>{formatTokenCount(model.totalOutputTokens)}</TableCell>
                <TableCell className='text-right font-medium'>{formatCost(model.totalCost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
