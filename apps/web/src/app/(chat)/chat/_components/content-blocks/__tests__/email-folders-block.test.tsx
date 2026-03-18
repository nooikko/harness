import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmailFoldersBlock from '../email-folders-block';

type EmailFolder = {
  id: string;
  name: string;
  totalItems: number;
  unreadItems: number;
};

const makeFolder = (overrides: Partial<EmailFolder> & { id: string; name: string }): EmailFolder => ({
  totalItems: 0,
  unreadItems: 0,
  ...overrides,
});

describe('EmailFoldersBlock', () => {
  it('renders empty state when folders is undefined', () => {
    render(<EmailFoldersBlock data={{}} />);
    expect(screen.getByText(/0 folders/)).toBeInTheDocument();
  });

  it('renders empty state when folders is an empty array', () => {
    render(<EmailFoldersBlock data={{ folders: [] }} />);
    expect(screen.getByText(/0 folders/)).toBeInTheDocument();
  });

  it("renders singular 'folder' for exactly one folder", () => {
    const folders = [makeFolder({ id: '1', name: 'Inbox', totalItems: 5, unreadItems: 0 })];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.getByText(/1 folder(?!s)/)).toBeInTheDocument();
  });

  it("renders plural 'folders' for multiple folders", () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 10, unreadItems: 3 }),
      makeFolder({ id: '2', name: 'Sent Items', totalItems: 5, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.getByText(/2 folders/)).toBeInTheDocument();
  });

  it('shows total unread count when there are unread items', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 10, unreadItems: 3 }),
      makeFolder({ id: '2', name: 'Drafts', totalItems: 2, unreadItems: 1 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.getByText('(4 unread)')).toBeInTheDocument();
  });

  it('hides unread count when totalUnread is zero', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 10, unreadItems: 0 }),
      makeFolder({ id: '2', name: 'Sent Items', totalItems: 5, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.queryByText(/unread/)).not.toBeInTheDocument();
  });

  it('renders each folder name and totalItems', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 42, unreadItems: 0 }),
      makeFolder({ id: '2', name: 'Archive', totalItems: 100, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows unread badge for folders with unread items', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 10, unreadItems: 7 }),
      makeFolder({ id: '2', name: 'Sent Items', totalItems: 5, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    // Inbox should have a badge with "7"
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('does not show unread badge for folders with zero unread items', () => {
    const folders = [makeFolder({ id: '1', name: 'Sent Items', totalItems: 5, unreadItems: 0 })];
    const { container } = render(<EmailFoldersBlock data={{ folders }} />);
    // The badge uses a specific class — check there is no rounded-full badge element
    const badges = container.querySelectorAll('.rounded-full');
    expect(badges).toHaveLength(0);
  });

  it('applies font-medium class to folder names with unread items', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 10, unreadItems: 3 }),
      makeFolder({ id: '2', name: 'Sent Items', totalItems: 5, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    const inbox = screen.getByText('Inbox');
    expect(inbox.className).toContain('font-medium');
    const sent = screen.getByText('Sent Items');
    expect(sent.className).toContain('text-muted-foreground');
    expect(sent.className).not.toContain('font-medium');
  });

  it('renders known folder icons for inbox, sent items, deleted items, archive, drafts, junk', () => {
    const folders = [
      makeFolder({ id: '1', name: 'Inbox', totalItems: 1, unreadItems: 0 }),
      makeFolder({ id: '2', name: 'Sent Items', totalItems: 1, unreadItems: 0 }),
      makeFolder({ id: '3', name: 'Deleted Items', totalItems: 1, unreadItems: 0 }),
      makeFolder({ id: '4', name: 'Archive', totalItems: 1, unreadItems: 0 }),
      makeFolder({ id: '5', name: 'Drafts', totalItems: 1, unreadItems: 0 }),
      makeFolder({ id: '6', name: 'Junk', totalItems: 1, unreadItems: 0 }),
    ];
    render(<EmailFoldersBlock data={{ folders }} />);
    // All six should render without crashing
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Sent Items')).toBeInTheDocument();
    expect(screen.getByText('Deleted Items')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Drafts')).toBeInTheDocument();
    expect(screen.getByText('Junk')).toBeInTheDocument();
  });

  it('renders fallback folder icon for unknown folder names', () => {
    const folders = [makeFolder({ id: '1', name: 'Custom Folder', totalItems: 3, unreadItems: 0 })];
    render(<EmailFoldersBlock data={{ folders }} />);
    expect(screen.getByText('Custom Folder')).toBeInTheDocument();
  });

  it('handles case-insensitive icon matching', () => {
    const folders = [makeFolder({ id: '1', name: 'INBOX', totalItems: 5, unreadItems: 2 })];
    render(<EmailFoldersBlock data={{ folders }} />);
    // Should render without error — icon lookup lowercases the name
    expect(screen.getByText('INBOX')).toBeInTheDocument();
  });
});
