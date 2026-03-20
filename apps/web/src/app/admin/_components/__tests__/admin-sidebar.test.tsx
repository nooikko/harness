import { SidebarProvider } from '@harness/ui';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPathname = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { AdminSidebar } = await import('../admin-sidebar');

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('AdminSidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/admin/cron-jobs');
  });

  it('renders the Account group label', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('renders the Profile link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/admin/profile');
  });

  it('renders the Cron Jobs link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Cron Jobs' })).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('renders the Plugins link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Plugins' })).toHaveAttribute('href', '/admin/plugins');
  });

  it('renders the Tasks link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('href', '/admin/tasks');
  });

  it('renders the Agent Runs link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Agent Runs' })).toHaveAttribute('href', '/admin/agent-runs');
  });

  it('renders the Threads link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Threads' })).toHaveAttribute('href', '/admin/threads');
  });

  it('renders the Usage link', () => {
    renderWithProvider(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'Usage' })).toHaveAttribute('href', '/admin/usage');
  });

  it('renders all 9 navigation links', () => {
    renderWithProvider(<AdminSidebar />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(10);
  });

  it('renders an SVG icon for each nav item', () => {
    renderWithProvider(<AdminSidebar />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.querySelector('svg')).toBeInTheDocument();
    }
  });
});
