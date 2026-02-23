import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from '../progress';

describe('Progress', () => {
  it('renders with progressbar role', () => {
    render(<Progress value={50} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('reflects the value attribute', () => {
    render(<Progress value={75} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
  });

  it('merges custom className', () => {
    render(<Progress value={0} className='h-4' />);
    expect(screen.getByRole('progressbar').className).toContain('h-4');
  });
});
