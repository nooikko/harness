import { render, screen } from '@testing-library/react';
import { Clock } from 'lucide-react';
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

describe('AdminNavLink', () => {
  it('renders a link with the correct href', () => {
    mockPathname.mockReturnValue('/admin/other');
    render(<AdminNavLink href='/admin/cron-jobs' icon={Clock} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link).toHaveAttribute('href', '/admin/cron-jobs');
  });

  it('renders the label text', () => {
    mockPathname.mockReturnValue('/admin/other');
    render(<AdminNavLink href='/admin/plugins' icon={Clock} label='Plugins' />);
    expect(screen.getByText('Plugins')).toBeInTheDocument();
  });

  it('applies active styles when pathname matches href', () => {
    mockPathname.mockReturnValue('/admin/cron-jobs');
    render(<AdminNavLink href='/admin/cron-jobs' icon={Clock} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('bg-secondary');
    expect(link.className).toContain('text-foreground');
  });

  it('applies active styles when pathname is a sub-path of href', () => {
    mockPathname.mockReturnValue('/admin/cron-jobs/123');
    render(<AdminNavLink href='/admin/cron-jobs' icon={Clock} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('bg-secondary');
    expect(link.className).toContain('text-foreground');
  });

  it('applies inactive styles when pathname does not match href', () => {
    mockPathname.mockReturnValue('/admin/plugins');
    render(<AdminNavLink href='/admin/cron-jobs' icon={Clock} label='Cron Jobs' />);
    const link = screen.getByRole('link', { name: 'Cron Jobs' });
    expect(link.className).toContain('text-muted-foreground');
    expect(link.className).not.toContain('bg-secondary ');
  });

  it('renders an SVG icon element', () => {
    mockPathname.mockReturnValue('/admin/other');
    const { container } = render(<AdminNavLink href='/admin/tasks' icon={Clock} label='Tasks' />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
