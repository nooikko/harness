import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../select';

describe('Select', () => {
  it('renders the trigger button', () => {
    render(
      <Select>
        <SelectTrigger data-testid='trigger'>
          <SelectValue placeholder='Pick one' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>Option A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
  });

  it('trigger has data-slot attribute', () => {
    render(
      <Select>
        <SelectTrigger data-testid='trigger'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-slot', 'select-trigger');
  });

  it('shows placeholder text when no value is selected', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder='Choose...' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>Option A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText('Choose...')).toBeInTheDocument();
  });

  it('reflects default value when provided', () => {
    render(
      <Select defaultValue='b'>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>Option A</SelectItem>
          <SelectItem value='b'>Option B</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('trigger is disabled when disabled prop is set', () => {
    render(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder='Disabled' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('merges custom className on trigger', () => {
    render(
      <Select>
        <SelectTrigger className='my-trigger-class' data-testid='trigger'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='a'>A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId('trigger').className).toContain('my-trigger-class');
  });

  it('SelectLabel renders within SelectGroup without throwing', () => {
    expect(() =>
      render(
        <Select defaultValue='a'>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Group Label</SelectLabel>
              <SelectItem value='a'>A</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });

  it('SelectSeparator renders without throwing', () => {
    expect(() =>
      render(
        <Select defaultValue='a'>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='a'>A</SelectItem>
            <SelectSeparator />
            <SelectItem value='b'>B</SelectItem>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });
});
