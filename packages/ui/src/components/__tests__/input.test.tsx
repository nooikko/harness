import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input data-testid='input' />);
    expect(screen.getByTestId('input').tagName).toBe('INPUT');
  });

  it('applies type prop', () => {
    render(<Input type='email' data-testid='input' />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
  });

  it('merges custom className', () => {
    render(<Input data-testid='input' className='w-64' />);
    expect(screen.getByTestId('input').className).toContain('w-64');
  });

  it('has data-slot attribute', () => {
    render(<Input data-testid='input' />);
    expect(screen.getByTestId('input')).toHaveAttribute('data-slot', 'input');
  });
});
