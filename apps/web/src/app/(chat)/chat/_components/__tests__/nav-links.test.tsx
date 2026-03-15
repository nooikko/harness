import { SidebarProvider } from '@harness/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { usePathname } from 'next/navigation';
import { NavLinks } from '../nav-links';

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('NavLinks', () => {
  it('renders three links: Projects, Tasks, Agents', () => {
    renderWithProvider(<NavLinks />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('Projects link is active when pathname is /chat/projects', () => {
    vi.mocked(usePathname).mockReturnValue('/chat/projects');
    renderWithProvider(<NavLinks />);
    const link = screen.getByRole('link', { name: /Projects/i });
    expect(link).toHaveAttribute('data-active', 'true');
  });

  it('Projects link is active when pathname starts with /chat/projects/', () => {
    vi.mocked(usePathname).mockReturnValue('/chat/projects/proj-123');
    renderWithProvider(<NavLinks />);
    const link = screen.getByRole('link', { name: /Projects/i });
    expect(link).toHaveAttribute('data-active', 'true');
  });

  it('Tasks link is active when pathname is /tasks', () => {
    vi.mocked(usePathname).mockReturnValue('/tasks');
    renderWithProvider(<NavLinks />);
    const link = screen.getByRole('link', { name: /Tasks/i });
    expect(link).toHaveAttribute('data-active', 'true');
  });

  it('Agents link is active when pathname is /agents', () => {
    vi.mocked(usePathname).mockReturnValue('/agents');
    renderWithProvider(<NavLinks />);
    const link = screen.getByRole('link', { name: /Agents/i });
    expect(link).toHaveAttribute('data-active', 'true');
  });
});
