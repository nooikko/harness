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

vi.mock('../new-thread-button', () => ({
  NewThreadButton: () => <button type='button'>New chat</button>,
}));

vi.mock('../manage-thread-modal', () => ({
  ManageThreadModal: () => null,
}));

vi.mock('../delete-thread-modal', () => ({
  DeleteThreadModal: () => null,
}));

vi.mock('@harness/database', () => ({}));

import { usePathname } from 'next/navigation';
import { NavChats } from '../nav-chats';

const makeThread = (overrides: Partial<{ id: string; name: string | null; kind: string; source: string; sourceId: string }> = {}) => ({
  id: 'thread-1',
  name: null,
  kind: 'default',
  source: 'web',
  sourceId: 'ch-1',
  model: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActivity: new Date(),
  sessionId: null,
  customInstructions: null,
  ...overrides,
});

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('NavChats', () => {
  it('renders the Recents group label', () => {
    renderWithProvider(<NavChats threads={[]} />);
    expect(screen.getByText('Recents')).toBeInTheDocument();
  });

  it('renders the New chat button', () => {
    renderWithProvider(<NavChats threads={[]} />);
    expect(screen.getByRole('button', { name: 'New chat' })).toBeInTheDocument();
  });

  it('renders an empty thread list with no thread links', () => {
    renderWithProvider(<NavChats threads={[]} />);
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });

  it('renders a thread using its name when name is set', () => {
    const thread = makeThread({ id: 'abc', name: 'My Thread', kind: 'default' });
    renderWithProvider(<NavChats threads={[thread as never]} />);
    expect(screen.getByText('My Thread')).toBeInTheDocument();
  });

  it('falls back to source/sourceId when thread name is null', () => {
    const thread = makeThread({ id: 'abc', name: null, source: 'discord', sourceId: 'ch-42' });
    renderWithProvider(<NavChats threads={[thread as never]} />);
    expect(screen.getByText('discord/ch-42')).toBeInTheDocument();
  });

  it('renders a link with the correct href for each thread', () => {
    const thread = makeThread({ id: 'thread-42', name: 'Chat 42', kind: 'default' });
    renderWithProvider(<NavChats threads={[thread as never]} />);
    const link = screen.getByRole('link', { name: /Chat 42/i });
    expect(link).toHaveAttribute('href', '/chat/thread-42');
  });

  it('marks the active thread link with isActive', () => {
    vi.mocked(usePathname).mockReturnValue('/chat/active-id');
    const active = makeThread({ id: 'active-id', name: 'Active', kind: 'default' });
    const inactive = makeThread({ id: 'other-id', name: 'Other', kind: 'default' });
    renderWithProvider(<NavChats threads={[active as never, inactive as never]} />);

    const activeLink = screen.getByRole('link', { name: /Active/i });
    const inactiveLink = screen.getByRole('link', { name: /Other/i });

    expect(activeLink).toHaveAttribute('data-active', 'true');
    expect(inactiveLink).toHaveAttribute('data-active', 'false');
  });

  it('marks no thread as active when pathname does not match', () => {
    vi.mocked(usePathname).mockReturnValue('/some-other-path');
    const thread = makeThread({ id: 'thread-1', name: 'Chat', kind: 'default' });
    renderWithProvider(<NavChats threads={[thread as never]} />);

    const link = screen.getByRole('link', { name: /Chat/i });
    expect(link).toHaveAttribute('data-active', 'false');
  });

  it('renders multiple threads', () => {
    const threads = [
      makeThread({ id: 't1', name: 'Thread One', kind: 'default' }),
      makeThread({ id: 't2', name: 'Thread Two', kind: 'default' }),
      makeThread({ id: 't3', name: null, source: 'discord', sourceId: 'srv-99' }),
    ];
    renderWithProvider(<NavChats threads={threads as never[]} />);
    expect(screen.getByText('Thread One')).toBeInTheDocument();
    expect(screen.getByText('Thread Two')).toBeInTheDocument();
    expect(screen.getByText('discord/srv-99')).toBeInTheDocument();
  });
});
