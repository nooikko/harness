import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUpdateAgent = vi.fn();
vi.mock('../../../chat/_actions/update-agent', () => ({
  updateAgent: (...args: unknown[]) => mockUpdateAgent(...args),
}));

import { EditAgentForm } from '../edit-agent-form';

const fakeAgent = {
  id: 'agent-1',
  name: 'My Agent',
  slug: 'my-agent',
  soul: 'Soul content',
  identity: 'Identity content',
  role: 'Engineer',
  goal: 'Ship fast',
  backstory: 'Some backstory',
  enabled: true,
  version: 3,
};

describe('EditAgentForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUpdateAgent.mockResolvedValue({ id: 'agent-1' });
  });

  it('renders with agent name pre-filled', () => {
    render(<EditAgentForm agent={fakeAgent} />);
    expect(screen.getByLabelText(/^name/i)).toHaveValue('My Agent');
  });

  it('shows slug and version', () => {
    render(<EditAgentForm agent={fakeAgent} />);
    expect(screen.getByText('my-agent')).toBeInTheDocument();
    expect(screen.getByText(/v3/)).toBeInTheDocument();
  });

  it('pre-fills soul and identity', () => {
    render(<EditAgentForm agent={fakeAgent} />);
    expect(screen.getByLabelText(/^soul/i)).toHaveValue('Soul content');
    expect(screen.getByLabelText(/^identity/i)).toHaveValue('Identity content');
  });

  it('shows success message after save', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/agent updated successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    mockUpdateAgent.mockResolvedValue({ error: 'Validation failed' });
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });
  });

  it('calls updateAgent with correct fields on submit', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgent).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-1', name: 'My Agent', enabled: true }));
    });
  });

  it('passes null for role and goal when fields are empty', async () => {
    const agentWithNulls = { ...fakeAgent, role: null, goal: null, backstory: null };
    const user = userEvent.setup();
    render(<EditAgentForm agent={agentWithNulls} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgent).toHaveBeenCalledWith(expect.objectContaining({ role: null, goal: null, backstory: null }));
    });
  });

  it('toggles enabled state via checkbox', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('Back to Agents navigates to /agents', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} />);

    await user.click(screen.getByRole('button', { name: /back to agents/i }));

    expect(mockPush).toHaveBeenCalledWith('/agents');
  });
});
