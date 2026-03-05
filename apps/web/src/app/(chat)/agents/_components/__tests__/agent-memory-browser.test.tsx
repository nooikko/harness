import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockDeleteAgentMemory = vi.fn();
vi.mock('../../../chat/_actions/delete-agent-memory', () => ({
  deleteAgentMemory: (...args: unknown[]) => mockDeleteAgentMemory(...args),
}));

import { AgentMemoryBrowser } from '../agent-memory-browser';

const makeMemory = (overrides: Record<string, unknown> = {}) => ({
  id: 'mem-1',
  content: 'Test memory content',
  type: 'EPISODIC' as const,
  importance: 5,
  threadId: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  lastAccessedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

describe('AgentMemoryBrowser', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockDeleteAgentMemory.mockResolvedValue(undefined);
  });

  it('renders the Memory heading', () => {
    render(<AgentMemoryBrowser agentId='agent-1' memories={[]} />);
    expect(screen.getByText('Memory')).toBeInTheDocument();
  });

  it('shows empty state when no memories', () => {
    render(<AgentMemoryBrowser agentId='agent-1' memories={[]} />);
    expect(screen.getByText(/no memories yet/i)).toBeInTheDocument();
  });

  it('renders memory content', () => {
    const memories = [makeMemory({ content: 'Important fact' })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    expect(screen.getByText('Important fact')).toBeInTheDocument();
  });

  it('renders filter tabs (All, Episodic, Semantic, Reflection)', () => {
    render(<AgentMemoryBrowser agentId='agent-1' memories={[]} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Episodic')).toBeInTheDocument();
    expect(screen.getByText('Semantic')).toBeInTheDocument();
    expect(screen.getByText('Reflection')).toBeInTheDocument();
  });

  it('filters memories by type when tab is clicked', async () => {
    const user = userEvent.setup();
    const memories = [
      makeMemory({ id: 'mem-1', content: 'Episodic memory', type: 'EPISODIC' }),
      makeMemory({ id: 'mem-2', content: 'Semantic memory', type: 'SEMANTIC' }),
    ];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);

    await user.click(screen.getByRole('tab', { name: /^Episodic/ }));

    expect(screen.getByText('Episodic memory')).toBeInTheDocument();
    expect(screen.queryByText('Semantic memory')).not.toBeInTheDocument();
  });

  it('shows empty filter message when no memories match active tab', async () => {
    const user = userEvent.setup();
    const memories = [makeMemory({ type: 'EPISODIC' })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);

    await user.click(screen.getByRole('tab', { name: /^Semantic/ }));

    expect(screen.getByText(/no semantic memories/i)).toBeInTheDocument();
  });

  it('shows Confirm on first Delete click', async () => {
    const user = userEvent.setup();
    const memories = [makeMemory()];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);

    await user.click(screen.getByRole('button', { name: /^delete/i }));

    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(mockDeleteAgentMemory).not.toHaveBeenCalled();
  });

  it('calls deleteAgentMemory on Confirm click and refreshes', async () => {
    const user = userEvent.setup();
    const memories = [makeMemory({ id: 'mem-42' })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);

    await user.click(screen.getByRole('button', { name: /^delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockDeleteAgentMemory).toHaveBeenCalledWith('mem-42', 'agent-1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('shows threadId snippet when memory has threadId', () => {
    const memories = [makeMemory({ threadId: 'thread-abcdef1234567890' })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    // ThreadId is truncated to first 8 chars
    expect(screen.getByText(/thread-a/)).toBeInTheDocument();
  });

  it('renders memories with different importance levels', () => {
    const memories = [
      makeMemory({ id: 'mem-low', importance: 3, content: 'Low importance' }),
      makeMemory({ id: 'mem-high', importance: 9, content: 'High importance' }),
      makeMemory({ id: 'mem-orange', importance: 7, content: 'Orange importance' }),
    ];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    expect(screen.getByText('Low importance')).toBeInTheDocument();
    expect(screen.getByText('High importance')).toBeInTheDocument();
    expect(screen.getByText('Orange importance')).toBeInTheDocument();
  });

  it('shows recent date for recent memories', () => {
    const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
    const memories = [makeMemory({ createdAt: recentDate })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('shows hours ago for memories under 24h', () => {
    const hoursAgo = new Date(Date.now() - 3 * 3_600_000); // 3 hours ago
    const memories = [makeMemory({ createdAt: hoursAgo })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    expect(screen.getByText(/3h ago/)).toBeInTheDocument();
  });

  it('shows days ago for memories under 30 days', () => {
    const daysAgo = new Date(Date.now() - 5 * 24 * 3_600_000); // 5 days ago
    const memories = [makeMemory({ createdAt: daysAgo })];
    render(<AgentMemoryBrowser agentId='agent-1' memories={memories} />);
    expect(screen.getByText(/5d ago/)).toBeInTheDocument();
  });
});
