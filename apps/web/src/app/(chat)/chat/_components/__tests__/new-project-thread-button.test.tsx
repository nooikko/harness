import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@harness/database', () => ({}));

const mockCreateThread = vi.fn().mockResolvedValue({ threadId: 'new-thread-1' });

vi.mock('../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

import { NewProjectThreadButton } from '../new-project-thread-button';

describe('NewProjectThreadButton', () => {
  beforeEach(() => {
    mockCreateThread.mockClear();
    mockPush.mockClear();
  });

  it('renders the button', () => {
    render(<NewProjectThreadButton projectId='proj-1' />);
    expect(screen.getByRole('button', { name: /new chat in project/i })).toBeInTheDocument();
  });

  it('calls createThread with the projectId and navigates on click', async () => {
    render(<NewProjectThreadButton projectId='proj-42' />);
    fireEvent.click(screen.getByRole('button', { name: /new chat in project/i }));
    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalledWith({ projectId: 'proj-42' });
      expect(mockPush).toHaveBeenCalledWith('/chat/new-thread-1');
    });
  });

  it('is disabled while pending', async () => {
    // Make createThread hang so we can check disabled state
    mockCreateThread.mockReturnValue(new Promise(() => {}));
    render(<NewProjectThreadButton projectId='proj-1' />);
    const button = screen.getByRole('button', { name: /new chat in project/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });
});
