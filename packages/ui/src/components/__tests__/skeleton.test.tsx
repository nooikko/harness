import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../skeleton';

describe('Skeleton', () => {
  it('renders with animate-pulse', () => {
    render(<Skeleton data-testid='skeleton' />);
    const el = screen.getByTestId('skeleton');
    expect(el.className).toContain('animate-pulse');
  });

  it('merges custom className', () => {
    render(<Skeleton data-testid='skeleton' className='h-10 w-40' />);
    const el = screen.getByTestId('skeleton');
    expect(el.className).toContain('h-10');
    expect(el.className).toContain('w-40');
  });

  it('has data-slot attribute', () => {
    render(<Skeleton data-testid='skeleton' />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('data-slot', 'skeleton');
  });
});
