import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Switch } from '../switch';

describe('Switch', () => {
  it('renders with data-slot attribute', () => {
    render(<Switch data-testid='sw' />);
    expect(screen.getByTestId('sw')).toHaveAttribute('data-slot', 'switch');
  });

  it('renders unchecked by default', () => {
    render(<Switch data-testid='sw' />);
    expect(screen.getByTestId('sw')).toHaveAttribute('data-state', 'unchecked');
  });

  it('renders checked when defaultChecked', () => {
    render(<Switch data-testid='sw' defaultChecked />);
    expect(screen.getByTestId('sw')).toHaveAttribute('data-state', 'checked');
  });

  it('toggles on click', () => {
    render(<Switch data-testid='sw' />);
    const sw = screen.getByTestId('sw');
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('data-state', 'checked');
  });

  it('merges custom className', () => {
    render(<Switch data-testid='sw' className='my-custom' />);
    expect(screen.getByTestId('sw').className).toContain('my-custom');
  });

  it('renders thumb with data-slot', () => {
    render(<Switch data-testid='sw' />);
    const thumb = screen.getByTestId('sw').querySelector("[data-slot='switch-thumb']");
    expect(thumb).toBeTruthy();
  });

  it('supports disabled state', () => {
    render(<Switch data-testid='sw' disabled />);
    expect(screen.getByTestId('sw')).toBeDisabled();
  });
});
