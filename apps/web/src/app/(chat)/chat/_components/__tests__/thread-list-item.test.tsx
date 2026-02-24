import { render, screen } from '@testing-library/react';
import type { Thread } from 'database';
import { describe, expect, it, vi } from 'vitest';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

import { ThreadListItem } from '../thread-list-item';

const makeThread = (overrides: Partial<Thread> = {}): Thread => ({
  id: 'thread-1',
  source: 'discord',
  sourceId: 'ch-1',
  name: 'Test Thread',
  kind: 'general',
  status: 'open',
  sessionId: null,
  model: null,
  parentThreadId: null,
  lastActivity: new Date('2026-02-23T10:00:00Z'),
  createdAt: new Date('2026-02-20T10:00:00Z'),
  updatedAt: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
});

describe('ThreadListItem', () => {
  it('renders thread name as a link', () => {
    render(<ThreadListItem thread={makeThread()} />);
    const link = screen.getByRole('link', { name: /Test Thread/ });
    expect(link).toHaveAttribute('href', '/chat/thread-1');
  });

  it('uses source/sourceId as fallback when name is null', () => {
    render(<ThreadListItem thread={makeThread({ name: null })} />);
    expect(screen.getByText('discord/ch-1')).toBeInTheDocument();
  });

  it('applies active styles when pathname matches thread', () => {
    mockPathname = '/chat/thread-1';
    render(<ThreadListItem thread={makeThread()} />);
    const link = screen.getByRole('link', { name: /Test Thread/ });
    expect(link.className).toContain('bg-accent');
  });

  it('does not apply active styles for different thread', () => {
    mockPathname = '/chat/other-thread';
    render(<ThreadListItem thread={makeThread()} />);
    const link = screen.getByRole('link', { name: /Test Thread/ });
    expect(link.className).not.toContain('bg-accent text-accent-foreground');
  });
});
