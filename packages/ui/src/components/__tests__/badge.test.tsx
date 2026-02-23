import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-primary');
  });

  it('renders secondary variant', () => {
    render(<Badge variant='secondary'>Secondary</Badge>);
    expect(screen.getByText('Secondary').className).toContain('bg-secondary');
  });

  it('renders outline variant', () => {
    render(<Badge variant='outline'>Outline</Badge>);
    expect(screen.getByText('Outline').className).toContain('border-border');
  });

  it('renders destructive variant', () => {
    render(<Badge variant='destructive'>Error</Badge>);
    expect(screen.getByText('Error').className).toContain('bg-destructive');
  });

  it('merges custom className', () => {
    render(<Badge className='extra'>Test</Badge>);
    expect(screen.getByText('Test').className).toContain('extra');
  });

  it('renders as child element when asChild is true', () => {
    render(
      <Badge asChild>
        <a href='/test'>Link Badge</a>
      </Badge>,
    );
    const link = screen.getByRole('link', { name: 'Link Badge' });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
  });
});
