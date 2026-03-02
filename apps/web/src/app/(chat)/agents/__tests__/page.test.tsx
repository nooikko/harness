import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockListAgents = vi.fn();
vi.mock('../../chat/_actions/list-agents', () => ({
  listAgents: () => mockListAgents(),
}));

vi.mock('../_components/agent-card', () => ({
  AgentCard: ({ name, slug }: { name: string; slug: string }) => (
    <div data-testid='agent-card'>
      {name} — {slug}
    </div>
  ),
}));

// Next.js Link and Button need basic stubs
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { default: AgentsPage } = await import('../page');

describe('AgentsPage', () => {
  it('renders the page heading', async () => {
    mockListAgents.mockResolvedValue([]);
    const jsx = await AgentsPage();
    render(jsx as React.ReactElement);
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders empty state when no agents', async () => {
    mockListAgents.mockResolvedValue([]);
    const jsx = await AgentsPage();
    render(jsx as React.ReactElement);
    expect(screen.getByText(/no agents yet/i)).toBeInTheDocument();
  });

  it('renders an AgentCard for each agent', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'a1', slug: 'agent-one', name: 'Agent One', enabled: true, _count: { threads: 3 } },
      { id: 'a2', slug: 'agent-two', name: 'Agent Two', enabled: false, _count: { threads: 0 } },
    ]);
    const jsx = await AgentsPage();
    render(jsx as React.ReactElement);
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2);
    expect(screen.getByText(/Agent One/)).toBeInTheDocument();
    expect(screen.getByText(/Agent Two/)).toBeInTheDocument();
  });

  it('renders a New Agent link', async () => {
    mockListAgents.mockResolvedValue([]);
    const jsx = await AgentsPage();
    render(jsx as React.ReactElement);
    const links = screen.getAllByRole('link', { name: /new agent/i });
    expect(links.length).toBeGreaterThan(0);
  });
});
