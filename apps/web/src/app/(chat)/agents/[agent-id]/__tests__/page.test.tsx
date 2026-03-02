import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockAgentConfigFindUnique = vi.fn();
vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    agentConfig: {
      findUnique: (...args: unknown[]) => mockAgentConfigFindUnique(...args),
    },
  },
}));

const mockListAgentMemories = vi.fn();
vi.mock('../../../chat/_actions/list-agent-memories', () => ({
  listAgentMemories: (...args: unknown[]) => mockListAgentMemories(...args),
}));

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('../../_components/edit-agent-form', () => ({
  EditAgentForm: () => <div data-testid='edit-agent-form' />,
}));

vi.mock('../../_components/agent-memory-browser', () => ({
  AgentMemoryBrowser: () => <div data-testid='memory-browser' />,
}));

const { default: AgentEditPage, generateMetadata } = await import('../page');

const makeParams = (id: string) => Promise.resolve({ 'agent-id': id });

const fakeAgent = {
  id: 'agent-1',
  slug: 'my-agent',
  name: 'My Agent',
  soul: 'Soul content',
  identity: 'Identity content',
  role: null,
  goal: null,
  backstory: null,
  enabled: true,
  version: 1,
};

describe('AgentEditPage', () => {
  it('calls notFound when agent does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockAgentConfigFindUnique.mockResolvedValue(null);
    mockListAgentMemories.mockResolvedValue([]);

    await expect(AgentEditPage({ params: makeParams('missing-id') })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('renders the agent name as heading', async () => {
    mockFindUnique.mockResolvedValue(fakeAgent);
    mockAgentConfigFindUnique.mockResolvedValue(null);
    mockListAgentMemories.mockResolvedValue([]);

    const jsx = await AgentEditPage({ params: makeParams('agent-1') });
    render(jsx as React.ReactElement);

    expect(screen.getByRole('heading', { name: 'My Agent' })).toBeInTheDocument();
  });

  it('renders EditAgentForm', async () => {
    mockFindUnique.mockResolvedValue(fakeAgent);
    mockAgentConfigFindUnique.mockResolvedValue(null);
    mockListAgentMemories.mockResolvedValue([]);

    const jsx = await AgentEditPage({ params: makeParams('agent-1') });
    render(jsx as React.ReactElement);

    expect(screen.getByTestId('edit-agent-form')).toBeInTheDocument();
  });

  it('renders AgentMemoryBrowser', async () => {
    mockFindUnique.mockResolvedValue(fakeAgent);
    mockAgentConfigFindUnique.mockResolvedValue(null);
    mockListAgentMemories.mockResolvedValue([]);

    const jsx = await AgentEditPage({ params: makeParams('agent-1') });
    render(jsx as React.ReactElement);

    expect(screen.getByTestId('memory-browser')).toBeInTheDocument();
  });
});

describe('generateMetadata', () => {
  it('returns title with agent name when agent exists', async () => {
    mockFindUnique.mockResolvedValue({ name: 'My Agent' });

    const metadata = await generateMetadata({ params: makeParams('agent-1') });

    expect(metadata.title).toContain('My Agent');
  });

  it('returns "Agent Not Found" title when agent does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const metadata = await generateMetadata({ params: makeParams('missing') });

    expect(metadata.title).toBe('Agent Not Found');
  });
});
