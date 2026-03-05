import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockListAgents = vi.fn().mockResolvedValue([
  { id: 'agent-1', name: 'Assistant', enabled: true },
  { id: 'agent-2', name: 'Researcher', enabled: true },
  { id: 'agent-3', name: 'Disabled Bot', enabled: false },
]);

const mockUpdateThreadAgent = vi.fn().mockResolvedValue(undefined);

vi.mock('../../_actions/list-agents', () => ({
  listAgents: (...args: unknown[]) => mockListAgents(...args),
}));

vi.mock('../../_actions/update-thread-agent', () => ({
  updateThreadAgent: (...args: unknown[]) => mockUpdateThreadAgent(...args),
}));

const { AgentSelector } = await import('../agent-selector');

describe('AgentSelector', () => {
  it('renders with current agent name', () => {
    render(<AgentSelector threadId='thread-1' currentAgentId='agent-1' currentAgentName='Assistant' />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('renders placeholder when no agent is assigned', () => {
    render(<AgentSelector threadId='thread-1' currentAgentId={null} currentAgentName={null} />);
    expect(screen.getByText('Select agent')).toBeInTheDocument();
  });

  it('has an accessible trigger button', () => {
    render(<AgentSelector threadId='thread-1' currentAgentId={null} currentAgentName={null} />);
    expect(screen.getByLabelText('Select agent')).toBeInTheDocument();
  });

  it('loads and displays agents when opened', async () => {
    const user = userEvent.setup();
    render(<AgentSelector threadId='thread-1' currentAgentId='agent-1' currentAgentName='Assistant' />);

    await user.click(screen.getByLabelText('Select agent'));

    expect(mockListAgents).toHaveBeenCalled();
    expect(await screen.findByText('Researcher')).toBeInTheDocument();
    // Disabled agent should not appear
    expect(screen.queryByText('Disabled Bot')).not.toBeInTheDocument();
  });

  it('calls updateThreadAgent when an agent is selected', async () => {
    const user = userEvent.setup();
    render(<AgentSelector threadId='thread-1' currentAgentId='agent-1' currentAgentName='Assistant' />);

    await user.click(screen.getByLabelText('Select agent'));
    const researcher = await screen.findByText('Researcher');
    await user.click(researcher);

    expect(mockUpdateThreadAgent).toHaveBeenCalledWith('thread-1', 'agent-2');
  });
});
