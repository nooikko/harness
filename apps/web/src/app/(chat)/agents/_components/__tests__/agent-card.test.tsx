import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockDeleteAgent = vi.fn();
vi.mock('../../../chat/_actions/delete-agent', () => ({
  deleteAgent: (...args: unknown[]) => mockDeleteAgent(...args),
}));

import { AgentCard } from '../agent-card';

const defaultProps = {
  id: 'agent-1',
  slug: 'my-agent',
  name: 'My Agent',
  enabled: true,
  threadCount: 3,
};

describe('AgentCard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockDeleteAgent.mockResolvedValue({ success: true });
  });

  it('renders the agent name', () => {
    render(<AgentCard {...defaultProps} />);
    expect(screen.getByText('My Agent')).toBeInTheDocument();
  });

  it('renders the slug', () => {
    render(<AgentCard {...defaultProps} />);
    expect(screen.getByText('my-agent')).toBeInTheDocument();
  });

  it('shows Enabled badge when enabled', () => {
    render(<AgentCard {...defaultProps} enabled={true} />);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('shows Disabled badge when not enabled', () => {
    render(<AgentCard {...defaultProps} enabled={false} />);
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('shows thread count with plural', () => {
    render(<AgentCard {...defaultProps} threadCount={3} />);
    expect(screen.getByText(/3 threads/)).toBeInTheDocument();
  });

  it('shows singular thread count', () => {
    render(<AgentCard {...defaultProps} threadCount={1} />);
    expect(screen.getByText(/1 thread\b/)).toBeInTheDocument();
  });

  it('navigates to agent edit page on Edit click', async () => {
    const user = userEvent.setup();
    render(<AgentCard {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(mockPush).toHaveBeenCalledWith('/agents/agent-1');
  });

  it('shows Confirm? on first Delete click', async () => {
    const user = userEvent.setup();
    render(<AgentCard {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /^delete/i }));

    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(mockDeleteAgent).not.toHaveBeenCalled();
  });

  it('calls deleteAgent on Confirm click', async () => {
    const user = userEvent.setup();
    render(<AgentCard {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /^delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockDeleteAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
