import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from '../label';

describe('Label', () => {
  it('renders a label element', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(
      <Label className='text-lg' data-testid='label'>
        Name
      </Label>,
    );
    expect(screen.getByTestId('label').className).toContain('text-lg');
  });

  it('has data-slot attribute', () => {
    render(<Label data-testid='label'>Name</Label>);
    expect(screen.getByTestId('label')).toHaveAttribute('data-slot', 'label');
  });
});
