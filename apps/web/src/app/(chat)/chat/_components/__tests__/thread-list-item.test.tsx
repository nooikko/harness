'use client';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../manage-thread-modal', () => ({
  ManageThreadModal: (props: { open: boolean }) => (props.open ? <div data-testid='manage-modal' /> : null),
}));

vi.mock('../delete-thread-modal', () => ({
  DeleteThreadModal: (props: { open: boolean }) => (props.open ? <div data-testid='delete-modal' /> : null),
}));

import { ThreadListItem } from '../thread-list-item';

const makeThread = (
  overrides: Partial<{
    id: string;
    name: string | null;
    source: string;
    sourceId: string;
    kind: string;
    model: string | null;
    customInstructions: string | null;
    projectId: string | null;
    parentThreadId: string | null;
    lastActivity: Date;
  }> = {},
) => ({
  id: 'thread-1',
  source: 'discord',
  sourceId: 'ch-1',
  name: 'Test Thread',
  kind: 'general',
  model: null,
  customInstructions: null,
  projectId: null,
  parentThreadId: null,
  lastActivity: new Date('2026-02-23T10:00:00Z'),
  ...overrides,
});

describe('ThreadListItem', () => {
  it('renders thread name as a link', () => {
    render(<ThreadListItem thread={makeThread()} isActive={false} projects={[]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/chat/thread-1');
    expect(link.textContent).toContain('Test Thread');
  });

  it('uses source/sourceId as fallback when name is null', () => {
    render(<ThreadListItem thread={makeThread({ name: null })} isActive={false} projects={[]} />);
    expect(screen.getByText('discord/ch-1')).toBeInTheDocument();
  });

  it('applies active styles when isActive is true', () => {
    render(<ThreadListItem thread={makeThread()} isActive={true} projects={[]} />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('active');
  });

  it('does not apply active styles when isActive is false', () => {
    render(<ThreadListItem thread={makeThread()} isActive={false} projects={[]} />);
    const link = screen.getByRole('link');
    expect(link.className).not.toContain('bg-accent text-accent-foreground');
  });

  it('renders the thread options button', () => {
    render(<ThreadListItem thread={makeThread()} isActive={false} projects={[]} />);
    expect(screen.getByRole('button', { name: /thread options/i })).toBeInTheDocument();
  });

  it('opens manage modal when Manage dropdown item is selected', async () => {
    const user = userEvent.setup();
    render(<ThreadListItem thread={makeThread()} isActive={false} projects={[]} />);

    await user.click(screen.getByRole('button', { name: /thread options/i }));
    const manageItem = await screen.findByText('Manage');
    await user.click(manageItem);

    expect(screen.getByTestId('manage-modal')).toBeInTheDocument();
  });

  it('opens delete modal when Delete dropdown item is selected', async () => {
    const user = userEvent.setup();
    render(<ThreadListItem thread={makeThread()} isActive={false} projects={[]} />);

    await user.click(screen.getByRole('button', { name: /thread options/i }));
    const deleteItem = await screen.findByText('Delete');
    await user.click(deleteItem);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });
});
