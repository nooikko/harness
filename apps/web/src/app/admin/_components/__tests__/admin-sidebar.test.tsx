import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/cron-jobs',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { AdminSidebar } = await import('../admin-sidebar');

describe('AdminSidebar', () => {
  it("renders a nav element with 'Admin navigation' aria-label", () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
  });

  it("renders the 'Admin' heading", () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument();
  });

  it('renders the Cron Jobs link', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Cron Jobs' })).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('renders the Plugins link', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Plugins' })).toHaveAttribute('href', '/admin/plugins');
  });

  it('renders the Tasks link', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/admin/tasks');
  });

  it('renders the Agent Runs link', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Agent Runs' })).toHaveAttribute('href', '/admin/agent-runs');
  });

  it('renders the Threads link', () => {
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Threads' })).toHaveAttribute('href', '/admin/threads');
  });

  it('renders all 5 navigation links', () => {
    render(<AdminSidebar />);
    const nav = screen.getByRole('navigation', { name: 'Admin navigation' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(5);
  });
});
