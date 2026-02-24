import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateThread = vi.fn();
vi.mock('../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

const { NewThreadButton } = await import('../new-thread-button');

describe('NewThreadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button with new chat label', () => {
    render(<NewThreadButton />);
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('calls createThread and navigates on click', async () => {
    mockCreateThread.mockResolvedValue({ threadId: 'new-1' });
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(mockCreateThread).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/chat/new-1');
  });
});
