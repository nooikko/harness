import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DailyUsage } from '../../_helpers/fetch-usage-over-time';
import { UsageOverTimeChart } from '../usage-over-time-chart';

describe('UsageOverTimeChart', () => {
  it('renders empty state when no data is provided', () => {
    render(<UsageOverTimeChart data={[]} />);

    expect(screen.getByText('No usage data for this period.')).toBeInTheDocument();
  });

  it('renders the heading', () => {
    render(<UsageOverTimeChart data={[]} />);

    expect(screen.getByText('Usage Over Time')).toBeInTheDocument();
  });

  it('renders bars for each day', () => {
    const data: DailyUsage[] = [
      { date: '2025-01-15', totalTokens: 1000, totalCost: 0.005 },
      { date: '2025-01-16', totalTokens: 2000, totalCost: 0.01 },
    ];

    render(<UsageOverTimeChart data={data} />);

    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(2);
  });

  it('displays date labels truncated to MM-DD', () => {
    const data: DailyUsage[] = [{ date: '2025-01-15', totalTokens: 1000, totalCost: 0.005 }];

    render(<UsageOverTimeChart data={data} />);

    expect(screen.getByText('01-15')).toBeInTheDocument();
  });

  it('displays formatted token counts', () => {
    const data: DailyUsage[] = [{ date: '2025-01-15', totalTokens: 5000, totalCost: 0.025 }];

    render(<UsageOverTimeChart data={data} />);

    expect(screen.getByText('5.0K')).toBeInTheDocument();
  });
});
