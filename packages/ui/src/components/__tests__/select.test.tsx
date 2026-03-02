import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';

const renderSelect = (defaultValue?: string) =>
  render(
    <Select defaultValue={defaultValue}>
      <SelectTrigger aria-label='Pick a fruit'>
        <SelectValue placeholder='Select...' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='apple'>Apple</SelectItem>
        <SelectItem value='banana'>Banana</SelectItem>
        <SelectItem value='cherry'>Cherry</SelectItem>
      </SelectContent>
    </Select>,
  );

describe('Select', () => {
  it('renders the trigger button', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows placeholder text when no value is selected', () => {
    renderSelect();
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('shows the pre-selected value label', () => {
    renderSelect('banana');
    expect(screen.getByRole('combobox')).toHaveTextContent('Banana');
  });

  it('trigger has the correct data-slot attribute', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveAttribute('data-slot', 'select-trigger');
  });

  it('trigger starts in closed state', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveAttribute('data-state', 'closed');
  });

  it('trigger has aria-label forwarded', () => {
    renderSelect();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Pick a fruit');
  });
});
