import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UsageSummary } from '../../_helpers/fetch-usage-summary';
import { UsageSummaryCards } from '../usage-summary-cards';

type MakeSummary = (overrides?: Partial<UsageSummary>) => UsageSummary;

const makeSummary: MakeSummary = (overrides = {}) => ({
  totalInputTokens: 10000,
  totalOutputTokens: 5000,
  totalTokens: 15000,
  totalCost: 0.105,
  totalRuns: 25,
  ...overrides,
});

describe('UsageSummaryCards', () => {
  it('renders all four summary cards', () => {
    render(<UsageSummaryCards summary={makeSummary()} />);

    expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    expect(screen.getByText('Input Tokens')).toBeInTheDocument();
    expect(screen.getByText('Output Tokens')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
  });

  it('displays formatted token counts', () => {
    render(<UsageSummaryCards summary={makeSummary()} />);

    expect(screen.getByText('15.0K')).toBeInTheDocument();
    expect(screen.getByText('10.0K')).toBeInTheDocument();
    expect(screen.getByText('5.0K')).toBeInTheDocument();
  });

  it('displays formatted cost', () => {
    render(<UsageSummaryCards summary={makeSummary({ totalCost: 5.25 })} />);

    expect(screen.getByText('$5.25')).toBeInTheDocument();
  });

  it('displays run count', () => {
    render(<UsageSummaryCards summary={makeSummary({ totalRuns: 42 })} />);

    expect(screen.getByText('42 runs')).toBeInTheDocument();
  });
});
