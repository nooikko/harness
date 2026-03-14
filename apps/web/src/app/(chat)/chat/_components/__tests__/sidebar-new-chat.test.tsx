'use client';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

vi.mock('@harness/database', () => ({}));

import { SidebarNewChat } from '../sidebar-new-chat';

describe('SidebarNewChat', () => {
  it('renders a New chat link', () => {
    render(<SidebarNewChat />);
    const link = screen.getByText('New chat');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/chat/new');
  });

  it('renders a Plus icon', () => {
    render(<SidebarNewChat />);
    expect(screen.getByText('New chat').parentElement?.querySelector('svg')).toBeInTheDocument();
  });
});
