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

vi.mock('@harness/database', () => ({}));

import { usePathname } from 'next/navigation';
import { NavChats } from '../nav-chats';

const makeThread = (overrides: Partial<{ id: string; name: string | null; kind: string }> = {}) => ({
  id: 'thread-1',
  name: null,
  kind: 'default',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActivity: new Date(),
  sessionId: null,
  modelId: null,
  ...overrides,
});

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('NavChats', () => {
  it('renders the Direct Chats group label', () => {
    renderWithProvider(<NavChats threads={[]} />);
    expect(screen.getByText('Direct Chats')).toBeInTheDocument();
  });

  it('renders the Chats collapsible trigger', () => {
    renderWithProvider(<NavChats threads={[]} />);
    expect(screen.getByText('Chats')).toBeInTheDocument();
  });

  it('renders the "New chat" label', () => {
    renderWithProvider(<NavChats threads={[]} />);
    // The "New chat" text appears in a span alongside the NewThreadButton
    const spans = screen.getAllByText('New chat');
    expect(spans.length).toBeGreaterThanOrEqual(1);
    // Check the span specifically
    const labelSpan = spans.find((el) => el.tagName === 'SPAN');
    expect(labelSpan).toBeInTheDocument();
  });

  it('renders an empty thread list with no thread links', () => {
    renderWithProvider(<NavChats threads={[]} />);
    // Only the NewThreadButton link should be present, no thread links
    const links = screen.queryAllByRole('link');
    expect(links).toHaveLength(0);
  });

  it('renders a thread using its name when name is set', () => {
    const thread = makeThread({ id: 'abc', name: 'My Thread', kind: 'default' });
    renderWithProvider(<NavChats threads={[thread as never]} />);
    expect(screen.getByText('My Thread')).toBeInTheDocument();
  });

  it('falls back to kind when thread name is null', () => {
    const thread = makeThread({ id: 'abc', name: null, kind: 'task' });
    renderWithProvider(<NavChats threads={[thread as never]} />);
    expect(screen.getByText('task')).toBeInTheDocument();
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

    // With asChild, the <a> element receives the data-sidebar and data-active attributes
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
      makeThread({ id: 't3', name: null, kind: 'task' }),
    ];
    renderWithProvider(<NavChats threads={threads as never[]} />);
    expect(screen.getByText('Thread One')).toBeInTheDocument();
    expect(screen.getByText('Thread Two')).toBeInTheDocument();
    expect(screen.getByText('task')).toBeInTheDocument();
  });
});
