import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

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

  it('renders Chat nav link', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
  });

  it('renders Usage nav link', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: 'Usage' })).toBeInTheDocument();
  });

  it('renders Admin nav link', () => {
    render(<TopBar />);
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('renders a nav element with main navigation label', () => {
    render(<TopBar />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders a header element', () => {
    render(<TopBar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
