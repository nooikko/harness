import { render, screen } from '@testing-library/react';
import type { LucideIcon } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

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

const { AdminNavLink } = await import('../admin-nav-link');

const MockIcon = (({ className }: { className?: string }) => <span data-testid='mock-icon' className={className} />) as unknown as LucideIcon;

describe('AdminNavLink', () => {
  it('renders a link with the correct href', () => {
    mockPathname.mockReturnValue('/admin/other');
    render(<AdminNavLink href='/admin/cron-jobs' icon={MockIcon} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('renders the icon and label', () => {
    mockPathname.mockReturnValue('/admin/other');
    render(<AdminNavLink href='/admin/plugins' icon={MockIcon} label='Plugins' />);
    expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    expect(screen.getByText('Plugins')).toBeInTheDocument();
  });

  it('applies active styles when pathname matches href', () => {
    mockPathname.mockReturnValue('/admin/cron-jobs');
    render(<AdminNavLink href='/admin/cron-jobs' icon={MockIcon} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('bg-secondary');
    expect(link.className).toContain('text-foreground');
  });

  it('applies active styles when pathname is a sub-path of href', () => {
    mockPathname.mockReturnValue('/admin/cron-jobs/123');
    render(<AdminNavLink href='/admin/cron-jobs' icon={MockIcon} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('bg-secondary');
    expect(link.className).toContain('text-foreground');
  });

  it('applies inactive styles when pathname does not match href', () => {
    mockPathname.mockReturnValue('/admin/plugins');
    render(<AdminNavLink href='/admin/cron-jobs' icon={MockIcon} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('text-muted-foreground');
    expect(link.className).not.toContain('bg-secondary ');
  });

  it('renders the icon with correct sizing classes', () => {
    mockPathname.mockReturnValue('/admin/other');
    render(<AdminNavLink href='/admin/tasks' icon={MockIcon} label='Tasks' />);
    const icon = screen.getByTestId('mock-icon');
    expect(icon.className).toContain('h-4');
    expect(icon.className).toContain('w-4');
  });
});
