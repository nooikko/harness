import { SidebarProvider } from '@harness/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { UserProfileMenu } from '../user-profile-menu';

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('UserProfileMenu', () => {
  it('renders without crashing', () => {
    renderWithProvider(<UserProfileMenu />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders a Settings menu button trigger', () => {
    renderWithProvider(<UserProfileMenu />);
    const button = screen.getByRole('button', { name: /settings/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-sidebar', 'menu-button');
  });

  it('renders with lg size', () => {
    renderWithProvider(<UserProfileMenu />);
    const button = screen.getByRole('button', { name: /settings/i });
    expect(button).toHaveAttribute('data-size', 'lg');
  });

  it('renders inside a SidebarMenu list', () => {
    renderWithProvider(<UserProfileMenu />);
    const menu = screen.getByRole('list');
    expect(menu).toHaveAttribute('data-sidebar', 'menu');
  });

  it('renders the trigger button with a data-sidebar attribute', () => {
    renderWithProvider(<UserProfileMenu />);
    const button = screen.getByRole('button', { name: /settings/i });
    // Radix DropdownMenuTrigger with asChild merges its attributes; the button
    // still carries data-sidebar from the SidebarMenuButton
    expect(button).toHaveAttribute('data-sidebar', 'menu-button');
  });

  it('renders a dropdown menu that can be opened showing Admin and Usage links', async () => {
    renderWithProvider(<UserProfileMenu />);
    const trigger = screen.getByRole('button', { name: /settings/i });
    await userEvent.click(trigger);
    // DropdownMenuItems use asChild with <Link>, so they render as links
    // The link text is visible after the dropdown opens
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
  });
});
