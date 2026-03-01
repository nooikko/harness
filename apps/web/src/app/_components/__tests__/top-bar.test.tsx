import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { TopBar } = await import('../top-bar');

describe('TopBar', () => {
  it('renders "Harness" as a link to /', () => {
    render(<TopBar />);
    const link = screen.getByRole('link', { name: 'Harness' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders a header element', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the search button', () => {
    render(<TopBar />);
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument();
  });

  it('renders the ⌘K keyboard shortcut hint', () => {
    render(<TopBar />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });
});
