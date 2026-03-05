import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BudgetWarning } from '../budget-warning';

describe('BudgetWarning', () => {
  it('renders normal budget status when under 80%', () => {
    render(<BudgetWarning currentCost={50} budgetUsd={100} />);

    expect(screen.getByTestId('budget-status')).toBeInTheDocument();
    expect(screen.getByText('50.0% of budget used')).toBeInTheDocument();
  });

  it('renders warning when at 80% of budget', () => {
    render(<BudgetWarning currentCost={80} budgetUsd={100} />);

    expect(screen.getByTestId('budget-warning')).toBeInTheDocument();
    expect(screen.getByText('Approaching budget limit')).toBeInTheDocument();
  });

  it('renders critical warning when budget is exceeded', () => {
    render(<BudgetWarning currentCost={120} budgetUsd={100} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Budget exceeded!')).toBeInTheDocument();
  });

  it('uses default budget of $100 when not specified', () => {
    render(<BudgetWarning currentCost={50} />);

    expect(screen.getByText('50.0% of budget used')).toBeInTheDocument();
  });

  it('displays formatted cost values', () => {
    render(<BudgetWarning currentCost={25.5} budgetUsd={100} />);

    expect(screen.getByText('$25.50 / $100.00')).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    render(<BudgetWarning currentCost={50} budgetUsd={100} />);

    expect(screen.getByText('Monthly Budget')).toBeInTheDocument();
  });
});
