import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Separator } from '../separator';

describe('Separator', () => {
  it('renders horizontal separator by default', () => {
    render(<Separator data-testid='sep' />);
    expect(screen.getByTestId('sep')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('renders vertical separator', () => {
    render(<Separator orientation='vertical' data-testid='sep' />);
    expect(screen.getByTestId('sep')).toHaveAttribute('data-orientation', 'vertical');
  });

  it('merges custom className', () => {
    render(<Separator data-testid='sep' className='my-4' />);
    expect(screen.getByTestId('sep').className).toContain('my-4');
  });

  it('has data-slot attribute', () => {
    render(<Separator data-testid='sep' />);
    expect(screen.getByTestId('sep')).toHaveAttribute('data-slot', 'separator');
  });
});
