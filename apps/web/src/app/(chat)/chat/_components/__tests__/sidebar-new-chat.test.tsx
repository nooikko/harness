'use client';

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

const mockCreateThread = vi.fn().mockResolvedValue({ threadId: 'new-thread-1' });
vi.mock('../../_actions/create-thread', () => ({
  createThread: (...args: unknown[]) => mockCreateThread(...args),
}));

const mockListAgents = vi.fn().mockResolvedValue([]);
vi.mock('../../_actions/list-agents', () => ({
  listAgents: () => mockListAgents(),
}));

vi.mock('@harness/database', () => ({}));

import { SidebarNewChat } from '../sidebar-new-chat';

describe('SidebarNewChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAgents.mockResolvedValue([]);
  });

  it('renders a New chat button', () => {
    render(<SidebarNewChat />);
    expect(screen.getByText('New chat')).toBeInTheDocument();
  });

  it('creates a thread immediately when no agents exist', async () => {
    mockListAgents.mockResolvedValue([]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledWith({ agentId: undefined }));
    expect(mockPush).toHaveBeenCalledWith('/chat/new-thread-1');
  });

  it('shows agent picker when agents exist', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'a1', name: 'Agent Alpha', enabled: true },
      { id: 'a2', name: 'Agent Beta', enabled: true },
    ]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    expect(screen.getByText('No agent')).toBeInTheDocument();
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Agent Beta')).toBeInTheDocument();
  });

  it("creates thread without agent when 'No agent' is clicked", async () => {
    mockListAgents.mockResolvedValue([{ id: 'a1', name: 'Agent Alpha', enabled: true }]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    fireEvent.click(screen.getByText('No agent'));
    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledWith({ agentId: undefined }));
  });

  it('creates thread with selected agent', async () => {
    mockListAgents.mockResolvedValue([{ id: 'a1', name: 'Agent Alpha', enabled: true }]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    fireEvent.click(screen.getByText('Agent Alpha'));
    await waitFor(() => expect(mockCreateThread).toHaveBeenCalledWith({ agentId: 'a1' }));
  });

  it('filters out disabled agents', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'a1', name: 'Enabled Agent', enabled: true },
      { id: 'a2', name: 'Disabled Agent', enabled: false },
    ]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    expect(screen.getByText('Enabled Agent')).toBeInTheDocument();
    expect(screen.queryByText('Disabled Agent')).not.toBeInTheDocument();
  });

  it('toggles picker open and closed', async () => {
    mockListAgents.mockResolvedValue([{ id: 'a1', name: 'Agent Alpha', enabled: true }]);
    render(<SidebarNewChat />);
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New chat'));
    expect(screen.queryByText('Agent Alpha')).not.toBeInTheDocument();
  });

  it('closes picker on outside click', async () => {
    mockListAgents.mockResolvedValue([{ id: 'a1', name: 'Agent Alpha', enabled: true }]);
    render(
      <div>
        <SidebarNewChat />
        <div data-testid='outside'>Outside</div>
      </div>,
    );
    await waitFor(() => expect(mockListAgents).toHaveBeenCalled());

    fireEvent.click(screen.getByText('New chat'));
    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Agent Alpha')).not.toBeInTheDocument();
  });
});
