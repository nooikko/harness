import { render, screen } from '@testing-library/react';
import type { Thread } from 'database';
import { describe, expect, it, vi } from 'vitest';
import { ThreadSidebar } from '../thread-sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat/primary-1',
}));

type MakeThread = (overrides: Partial<Thread>) => Thread;

const makeThread: MakeThread = (overrides) => ({
  id: 'thread-1',
  source: 'web',
  sourceId: 'session-1',
  name: null,
  kind: 'general',
  status: 'open',
  parentThreadId: null,
  lastActivity: new Date('2025-01-15T12:00:00Z'),
  createdAt: new Date('2025-01-10T10:00:00Z'),
  updatedAt: new Date('2025-01-15T12:00:00Z'),
  ...overrides,
});

describe('ThreadSidebar', () => {
  it('renders the Threads heading', () => {
    render(<ThreadSidebar threads={[]} />);
    expect(screen.getByRole('heading', { name: 'Threads' })).toBeInTheDocument();
  });

  it('displays empty state when no threads exist', () => {
    render(<ThreadSidebar threads={[]} />);
    expect(screen.getByText('No threads yet')).toBeInTheDocument();
  });

  it('renders thread names in the list', () => {
    const threads = [makeThread({ id: 't1', name: 'My Thread', kind: 'general' }), makeThread({ id: 't2', name: 'Task Thread', kind: 'task' })];

    render(<ThreadSidebar threads={threads} />);

    expect(screen.getByText('My Thread')).toBeInTheDocument();
    expect(screen.getByText('Task Thread')).toBeInTheDocument();
  });

  it('pins primary thread to the top', () => {
    const threads = [
      makeThread({ id: 'general-1', name: 'General Thread', kind: 'general', lastActivity: new Date('2025-02-01T00:00:00Z') }),
      makeThread({ id: 'primary-1', name: 'Primary Thread', kind: 'primary', lastActivity: new Date('2025-01-01T00:00:00Z') }),
    ];

    render(<ThreadSidebar threads={threads} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Primary Thread');
    expect(items[1]).toHaveTextContent('General Thread');
  });

  it('renders a navigation element with Thread list label', () => {
    render(<ThreadSidebar threads={[]} />);
    expect(screen.getByRole('navigation', { name: 'Thread list' })).toBeInTheDocument();
  });

  it('renders links to each thread', () => {
    const threads = [makeThread({ id: 'abc123', name: 'Test Thread' })];

    render(<ThreadSidebar threads={threads} />);

    const link = screen.getByRole('link', { name: /Test Thread/ });
    expect(link).toHaveAttribute('href', '/chat/abc123');
  });

  it('displays source/sourceId when name is null', () => {
    const threads = [makeThread({ id: 't1', name: null, source: 'discord', sourceId: 'chan-123' })];

    render(<ThreadSidebar threads={threads} />);

    expect(screen.getByText('discord/chan-123')).toBeInTheDocument();
  });
});
