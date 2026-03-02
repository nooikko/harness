import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea data-testid='ta' />);
    expect(screen.getByTestId('ta').tagName).toBe('TEXTAREA');
  });

  it('has data-slot attribute set to textarea', () => {
    render(<Textarea data-testid='ta' />);
    expect(screen.getByTestId('ta')).toHaveAttribute('data-slot', 'textarea');
  });

  it('merges custom className', () => {
    render(<Textarea data-testid='ta' className='my-custom-class' />);
    expect(screen.getByTestId('ta').className).toContain('my-custom-class');
  });

  it('forwards placeholder prop', () => {
    render(<Textarea data-testid='ta' placeholder='Enter text here' />);
    expect(screen.getByTestId('ta')).toHaveAttribute('placeholder', 'Enter text here');
  });

  it('forwards disabled prop', () => {
    render(<Textarea data-testid='ta' disabled />);
    expect(screen.getByTestId('ta')).toBeDisabled();
  });

  it('renders with rows prop', () => {
    render(<Textarea data-testid='ta' rows={5} />);
    expect(screen.getByTestId('ta')).toHaveAttribute('rows', '5');
  });
});
