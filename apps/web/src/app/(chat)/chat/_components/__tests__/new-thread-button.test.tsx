import { act, render, screen, waitFor } from '@testing-library/react';
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

const mockListAgents = vi.fn();
vi.mock('../../_actions/list-agents', () => ({
  listAgents: (...args: unknown[]) => mockListAgents(...args),
}));

const { NewThreadButton } = await import('../new-thread-button');

// Helper: flush all pending microtasks so async useEffect state updates settle
const flushEffects = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('NewThreadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAgents.mockResolvedValue([]);
  });

  it('renders a button with new chat label', async () => {
    render(<NewThreadButton />);
    expect(screen.getByRole('button', { name: /new chat/i })).toBeInTheDocument();
  });

  it('calls createThread and navigates on click when no agents', async () => {
    mockCreateThread.mockResolvedValue({ threadId: 'new-1' });
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects(); // agents = []

    await user.click(screen.getByRole('button', { name: /new chat/i }));

    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/chat/new-1');
    });
  });

  it('shows picker when agents are available and button is clicked', async () => {
    mockListAgents.mockResolvedValue([{ id: 'agent-1', name: 'My Agent', enabled: true }]);
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects(); // agents = [My Agent]

    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(screen.getByText('No agent')).toBeInTheDocument();
    expect(screen.getByText('My Agent')).toBeInTheDocument();
  });

  it('creates thread with no agent when "No agent" is selected from picker', async () => {
    mockListAgents.mockResolvedValue([{ id: 'agent-1', name: 'My Agent', enabled: true }]);
    mockCreateThread.mockResolvedValue({ threadId: 'thread-2' });
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects();

    await user.click(screen.getByRole('button', { name: /new chat/i }));
    await user.click(screen.getByText('No agent'));

    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalledWith({ agentId: undefined });
      expect(mockPush).toHaveBeenCalledWith('/chat/thread-2');
    });
  });

  it('creates thread with agentId when an agent is selected', async () => {
    mockListAgents.mockResolvedValue([{ id: 'agent-1', name: 'My Agent', enabled: true }]);
    mockCreateThread.mockResolvedValue({ threadId: 'thread-3' });
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects();

    await user.click(screen.getByRole('button', { name: /new chat/i }));
    await user.click(screen.getByText('My Agent'));

    await waitFor(() => {
      expect(mockCreateThread).toHaveBeenCalledWith({ agentId: 'agent-1' });
      expect(mockPush).toHaveBeenCalledWith('/chat/thread-3');
    });
  });

  it('filters out disabled agents', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'agent-1', name: 'Enabled Agent', enabled: true },
      { id: 'agent-2', name: 'Disabled Agent', enabled: false },
    ]);
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects();

    await user.click(screen.getByRole('button', { name: /new chat/i }));

    expect(screen.getByText('Enabled Agent')).toBeInTheDocument();
    expect(screen.queryByText('Disabled Agent')).not.toBeInTheDocument();
  });

  it('closes picker on second click (toggle)', async () => {
    mockListAgents.mockResolvedValue([{ id: 'agent-1', name: 'My Agent', enabled: true }]);
    const user = userEvent.setup();

    render(<NewThreadButton />);
    await flushEffects();

    const btn = screen.getByRole('button', { name: /new chat/i });

    await user.click(btn);
    expect(screen.getByText('No agent')).toBeInTheDocument();

    await user.click(btn);
    expect(screen.queryByText('No agent')).not.toBeInTheDocument();
  });
});
