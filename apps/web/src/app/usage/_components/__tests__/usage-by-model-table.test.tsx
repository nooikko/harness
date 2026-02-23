import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModelUsage } from '../../_helpers/fetch-usage-by-model';
import { UsageByModelTable } from '../usage-by-model-table';

describe('UsageByModelTable', () => {
  it('renders empty state when no models are provided', () => {
    render(<UsageByModelTable models={[]} />);

    expect(screen.getByText('No usage data available yet.')).toBeInTheDocument();
  });

  it('renders model names in the table', () => {
    const models: ModelUsage[] = [
      { model: 'sonnet', totalInputTokens: 5000, totalOutputTokens: 2000, totalCost: 0.045, runCount: 10 },
      { model: 'opus', totalInputTokens: 1000, totalOutputTokens: 500, totalCost: 0.0525, runCount: 2 },
    ];

    render(<UsageByModelTable models={models} />);

    expect(screen.getByText('sonnet')).toBeInTheDocument();
    expect(screen.getByText('opus')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    const models: ModelUsage[] = [{ model: 'sonnet', totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, runCount: 1 }];

    render(<UsageByModelTable models={models} />);

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Runs')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('displays formatted run counts', () => {
    const models: ModelUsage[] = [{ model: 'sonnet', totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, runCount: 42 }];

    render(<UsageByModelTable models={models} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the Usage by Model heading', () => {
    render(<UsageByModelTable models={[]} />);

    expect(screen.getByText('Usage by Model')).toBeInTheDocument();
  });
});
