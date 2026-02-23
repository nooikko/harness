import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Loading from '../loading';

describe('Loading skeleton', () => {
  it('renders a loading status element', () => {
    render(<Loading />);
    expect(screen.getByRole('status', { name: 'Loading thread' })).toBeInTheDocument();
  });

  it('includes screen reader text for accessibility', () => {
    render(<Loading />);
    expect(screen.getByText('Loading thread content...')).toBeInTheDocument();
  });

  it('renders skeleton pulse elements', () => {
    const { container } = render(<Loading />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});
