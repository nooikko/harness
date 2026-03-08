import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kbd } from '../kbd';

describe('Kbd', () => {
  it('renders keyboard shortcut text', () => {
    render(<Kbd>⌘K</Kbd>);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('renders as kbd element', () => {
    render(<Kbd>Enter</Kbd>);
    expect(screen.getByText('Enter').tagName).toBe('KBD');
  });

  it('applies custom className', () => {
    render(<Kbd className='custom-class'>Tab</Kbd>);
    expect(screen.getByText('Tab')).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(<Kbd data-testid='shortcut'>Esc</Kbd>);
    expect(screen.getByTestId('shortcut')).toBeInTheDocument();
  });
});
