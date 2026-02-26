import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityChips } from '../activity-chips';

describe('ActivityChips', () => {
  it('renders model chip with model name', () => {
    render(<ActivityChips model='claude-sonnet-4-6' inputTokens={500} outputTokens={200} durationMs={1500} />);
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
  });

  it('renders token count chip', () => {
    render(<ActivityChips model='claude-sonnet-4-6' inputTokens={500} outputTokens={200} durationMs={1500} />);
    expect(screen.getByText('700 tokens')).toBeInTheDocument();
  });

  it('renders duration chip in seconds for >= 1000ms', () => {
    render(<ActivityChips model='claude-sonnet-4-6' inputTokens={100} outputTokens={100} durationMs={2300} />);
    expect(screen.getByText('2.3s')).toBeInTheDocument();
  });

  it('renders duration chip in ms for < 1000ms', () => {
    render(<ActivityChips model='claude-sonnet-4-6' inputTokens={100} outputTokens={100} durationMs={450} />);
    expect(screen.getByText('450ms')).toBeInTheDocument();
  });

  it('renders nothing when no data is provided', () => {
    const { container } = render(<ActivityChips />);
    expect(container.firstChild).toBeNull();
  });

  it('renders model chip with correct color for opus', () => {
    render(<ActivityChips model='claude-opus-4-6' inputTokens={100} outputTokens={100} durationMs={500} />);
    const chip = screen.getByText(/opus/i);
    expect(chip.className).toContain('purple');
  });

  it('renders model chip with correct color for haiku', () => {
    render(<ActivityChips model='claude-haiku-4-5' inputTokens={100} outputTokens={100} durationMs={500} />);
    const chip = screen.getByText(/haiku/i);
    expect(chip.className).toContain('emerald');
  });
});
