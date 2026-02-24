import { render, screen } from '@testing-library/react';
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

const { NavLink } = await import('../nav-link');

describe('NavLink', () => {
  it('renders a link with the correct href', () => {
    mockPathname.mockReturnValue('/other');
    render(<NavLink href='/usage'>Usage</NavLink>);
    const link = screen.getByRole('link', { name: 'Usage' });
    expect(link).toHaveAttribute('href', '/usage');
  });

  it('renders children as link text', () => {
    mockPathname.mockReturnValue('/other');
    render(<NavLink href='/admin'>Admin</NavLink>);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('applies active styles when pathname matches href', () => {
    mockPathname.mockReturnValue('/usage');
    render(<NavLink href='/usage'>Usage</NavLink>);
    const link = screen.getByRole('link', { name: 'Usage' });
    expect(link.className).toContain('text-foreground');
    expect(link.className).toContain('bg-secondary');
  });

  it('applies inactive styles when pathname does not match href', () => {
    mockPathname.mockReturnValue('/admin');
    render(<NavLink href='/usage'>Usage</NavLink>);
    const link = screen.getByRole('link', { name: 'Usage' });
    expect(link.className).toContain('text-muted-foreground');
    expect(link.className).not.toContain('bg-secondary ');
  });

  it('treats root href as active when pathname is "/"', () => {
    mockPathname.mockReturnValue('/');
    render(<NavLink href='/'>Chat</NavLink>);
    const link = screen.getByRole('link', { name: 'Chat' });
    expect(link.className).toContain('text-foreground');
    expect(link.className).toContain('bg-secondary');
  });

  it('treats root href as active when pathname starts with /chat', () => {
    mockPathname.mockReturnValue('/chat/thread-123');
    render(<NavLink href='/'>Chat</NavLink>);
    const link = screen.getByRole('link', { name: 'Chat' });
    expect(link.className).toContain('text-foreground');
    expect(link.className).toContain('bg-secondary');
  });

  it('treats root href as inactive when pathname is a different route', () => {
    mockPathname.mockReturnValue('/usage');
    render(<NavLink href='/'>Chat</NavLink>);
    const link = screen.getByRole('link', { name: 'Chat' });
    expect(link.className).toContain('text-muted-foreground');
  });

  it('matches non-root href by prefix', () => {
    mockPathname.mockReturnValue('/usage/details');
    render(<NavLink href='/usage'>Usage</NavLink>);
    const link = screen.getByRole('link', { name: 'Usage' });
    expect(link.className).toContain('text-foreground');
    expect(link.className).toContain('bg-secondary');
  });
});
