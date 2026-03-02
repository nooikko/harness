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

const mockUpdateAgentConfig = vi.fn();
vi.mock('../../../chat/_actions/update-agent-config', () => ({
  updateAgentConfig: (...args: unknown[]) => mockUpdateAgentConfig(...args),
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

const fakeAgentConfig = {
  memoryEnabled: true,
  reflectionEnabled: false,
};

describe('EditAgentForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockUpdateAgent.mockResolvedValue({ id: 'agent-1' });
    mockUpdateAgentConfig.mockResolvedValue({ success: true });
  });

  it('renders with agent name pre-filled', () => {
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);
    expect(screen.getByLabelText(/^name/i)).toHaveValue('My Agent');
  });

  it('shows slug and version', () => {
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);
    expect(screen.getByText('my-agent')).toBeInTheDocument();
    expect(screen.getByText(/v3/)).toBeInTheDocument();
  });

  it('pre-fills soul and identity', () => {
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);
    expect(screen.getByLabelText(/^soul/i)).toHaveValue('Soul content');
    expect(screen.getByLabelText(/^identity/i)).toHaveValue('Identity content');
  });

  it('shows success message after save', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/agent updated successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    mockUpdateAgent.mockResolvedValue({ error: 'Validation failed' });
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });
  });

  it('calls updateAgent with correct fields on submit', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgent).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-1', name: 'My Agent', enabled: true }));
    });
  });

  it('passes null for role and goal when fields are empty', async () => {
    const agentWithNulls = { ...fakeAgent, role: null, goal: null, backstory: null };
    const user = userEvent.setup();
    render(<EditAgentForm agent={agentWithNulls} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgent).toHaveBeenCalledWith(expect.objectContaining({ role: null, goal: null, backstory: null }));
    });
  });

  it('toggles enabled state via checkbox', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const checkbox = screen.getByLabelText('Enabled');
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('Back to Agents navigates to /agents', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /back to agents/i }));

    expect(mockPush).toHaveBeenCalledWith('/agents');
  });

  it('calls updateAgentConfig with correct fields on submit', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgentConfig).toHaveBeenCalledWith({
        agentId: 'agent-1',
        memoryEnabled: true,
        reflectionEnabled: false,
      });
    });
  });

  it('shows error message when updateAgentConfig returns an error', async () => {
    mockUpdateAgentConfig.mockResolvedValue({ error: 'Config update failed' });
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Config update failed')).toBeInTheDocument();
    });
  });

  it('does not show success when updateAgentConfig returns an error', async () => {
    mockUpdateAgentConfig.mockResolvedValue({ error: 'Config update failed' });
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText(/agent updated successfully/i)).not.toBeInTheDocument();
    });
  });

  it('toggles memoryEnabled checkbox', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const checkbox = screen.getByLabelText(/episodic memory/i);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('toggles reflectionEnabled checkbox', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const checkbox = screen.getByLabelText(/reflection cycle/i);
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('submits toggled memoryEnabled value to updateAgentConfig', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    await user.click(screen.getByLabelText(/episodic memory/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateAgentConfig).toHaveBeenCalledWith(expect.objectContaining({ memoryEnabled: false }));
    });
  });

  it('uses default values when agentConfig is null', () => {
    render(<EditAgentForm agent={fakeAgent} agentConfig={null} />);

    expect(screen.getByLabelText(/episodic memory/i)).toBeChecked();
    expect(screen.getByLabelText(/reflection cycle/i)).not.toBeChecked();
  });

  it('updates name field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    expect(nameInput).toHaveValue('New Name');
  });

  it('updates soul field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const soulTextarea = screen.getByLabelText(/^soul/i);
    await user.clear(soulTextarea);
    await user.type(soulTextarea, 'New soul content');

    expect(soulTextarea).toHaveValue('New soul content');
  });

  it('updates identity field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const identityTextarea = screen.getByLabelText(/^identity/i);
    await user.clear(identityTextarea);
    await user.type(identityTextarea, 'New identity content');

    expect(identityTextarea).toHaveValue('New identity content');
  });

  it('updates role field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const roleInput = screen.getByLabelText(/^role/i);
    await user.clear(roleInput);
    await user.type(roleInput, 'New Role');

    expect(roleInput).toHaveValue('New Role');
  });

  it('updates goal field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const goalInput = screen.getByLabelText(/^goal/i);
    await user.clear(goalInput);
    await user.type(goalInput, 'New Goal');

    expect(goalInput).toHaveValue('New Goal');
  });

  it('updates backstory field on change', async () => {
    const user = userEvent.setup();
    render(<EditAgentForm agent={fakeAgent} agentConfig={fakeAgentConfig} />);

    const backstoryTextarea = screen.getByLabelText(/^backstory/i);
    await user.clear(backstoryTextarea);
    await user.type(backstoryTextarea, 'New backstory');

    expect(backstoryTextarea).toHaveValue('New backstory');
  });
});
