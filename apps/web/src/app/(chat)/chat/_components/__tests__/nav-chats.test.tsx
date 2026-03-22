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

vi.mock('../thread-list-item', () => ({
  ThreadListItem: ({ thread, isActive }: { thread: { id: string; name: string | null; kind: string }; isActive: boolean }) => (
    <a href={`/chat/${thread.id}`} data-active={isActive} data-testid={`thread-${thread.id}`}>
      {thread.name ?? `${thread.kind}`}
    </a>
  ),
}));

vi.mock('@harness/database', () => ({}));

import { usePathname } from 'next/navigation';
import { NavChats } from '../nav-chats';

const makeThread = (
  overrides: Partial<{
    id: string;
    name: string | null;
    kind: string;
    source: string;
    sourceId: string;
  }> = {},
) => ({
  id: 'thread-1',
  name: null,
  kind: 'default',
  source: 'web',
  sourceId: 'src-1',
  model: null,
  effort: null,
  customInstructions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastActivity: new Date(),
  sessionId: null,
  ...overrides,
});

const renderWithProvider = (ui: React.ReactElement) => render(<SidebarProvider>{ui}</SidebarProvider>);

describe('NavChats', () => {
  it('renders the Recents group label', () => {
    renderWithProvider(<NavChats threads={[]} projects={[]} />);
    expect(screen.getByText('Recents')).toBeInTheDocument();
  });

  it('renders empty state when no threads', () => {
    renderWithProvider(<NavChats threads={[]} projects={[]} />);
    expect(screen.getByText('No chats yet')).toBeInTheDocument();
  });

  it('renders a thread using its name when name is set', () => {
    const thread = makeThread({
      id: 'abc',
      name: 'My Thread',
      kind: 'default',
    });
    renderWithProvider(<NavChats threads={[thread as never]} projects={[]} />);
    expect(screen.getByText('My Thread')).toBeInTheDocument();
  });

  it('falls back to kind when thread name is null', () => {
    const thread = makeThread({ id: 'abc', name: null, kind: 'task' });
    renderWithProvider(<NavChats threads={[thread as never]} projects={[]} />);
    expect(screen.getByText('task')).toBeInTheDocument();
  });

  it('marks the active thread via ThreadListItem', () => {
    vi.mocked(usePathname).mockReturnValue('/chat/active-id');
    const active = makeThread({
      id: 'active-id',
      name: 'Active',
      kind: 'default',
    });
    const inactive = makeThread({
      id: 'other-id',
      name: 'Other',
      kind: 'default',
    });
    renderWithProvider(<NavChats threads={[active as never, inactive as never]} projects={[]} />);

    expect(screen.getByTestId('thread-active-id')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('thread-other-id')).toHaveAttribute('data-active', 'false');
  });

  it('renders multiple threads', () => {
    const threads = [
      makeThread({ id: 't1', name: 'Thread One', kind: 'default' }),
      makeThread({ id: 't2', name: 'Thread Two', kind: 'default' }),
      makeThread({ id: 't3', name: null, kind: 'task' }),
    ];
    renderWithProvider(<NavChats threads={threads as never[]} projects={[]} />);
    expect(screen.getByText('Thread One')).toBeInTheDocument();
    expect(screen.getByText('Thread Two')).toBeInTheDocument();
    expect(screen.getByText('task')).toBeInTheDocument();
  });
});
