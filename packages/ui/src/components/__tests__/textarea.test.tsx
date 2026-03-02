import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from '../textarea';

describe('Textarea', () => {
  it('renders a textarea element', () => {
    render(<Textarea data-testid='ta' />);
    expect(screen.getByTestId('ta').tagName).toBe('TEXTAREA');
  });

  it('has data-slot attribute', () => {
    render(<Textarea data-testid='ta' />);
    expect(screen.getByTestId('ta')).toHaveAttribute('data-slot', 'textarea');
  });

  it('merges custom className', () => {
    render(<Textarea data-testid='ta' className='my-class' />);
    expect(screen.getByTestId('ta').className).toContain('my-class');
  });

  it('forwards placeholder prop', () => {
    render(<Textarea data-testid='ta' placeholder='Enter text' />);
    expect(screen.getByTestId('ta')).toHaveAttribute('placeholder', 'Enter text');
  });

  it('forwards rows prop', () => {
    render(<Textarea data-testid='ta' rows={5} />);
    expect(screen.getByTestId('ta')).toHaveAttribute('rows', '5');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Textarea data-testid='ta' disabled />);
    expect(screen.getByTestId('ta')).toBeDisabled();
  });
});
