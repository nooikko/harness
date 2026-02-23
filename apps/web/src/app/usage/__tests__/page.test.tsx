import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const { default: UsagePage } = await import('../page');

describe('UsagePage', () => {
  it('renders the page heading', () => {
    render(<UsagePage />);
    expect(screen.getByText('Token Usage')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<UsagePage />);
    expect(screen.getByText('Monitor token consumption, costs, and usage patterns across agent runs.')).toBeInTheDocument();
  });

  it('renders Suspense fallback skeletons before data loads', () => {
    const { container } = render(<UsagePage />);
    // Suspense fallbacks render skeleton placeholders
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
