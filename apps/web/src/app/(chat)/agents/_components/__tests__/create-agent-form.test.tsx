import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateAgent = vi.fn();
vi.mock('../../../chat/_actions/create-agent', () => ({
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
}));

import { CreateAgentForm } from '../create-agent-form';

describe('CreateAgentForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockCreateAgent.mockResolvedValue({ id: 'new-agent' });
  });

  it('renders name and slug fields', () => {
    render(<CreateAgentForm />);
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^slug/i)).toBeInTheDocument();
  });

  it('renders soul and identity textareas', () => {
    render(<CreateAgentForm />);
    expect(screen.getByLabelText(/^soul/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^identity/i)).toBeInTheDocument();
  });

  it('auto-derives slug from name', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'My Cool Agent');

    expect(screen.getByLabelText(/^slug/i)).toHaveValue('my-cool-agent');
  });

  it('manual slug edit stops auto-derive', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^slug/i), 'custom-slug');
    await user.type(screen.getByLabelText(/^name/i), 'Other Name');

    expect(screen.getByLabelText(/^slug/i)).toHaveValue('custom-slug');
  });

  it('navigates to /agents on successful submit', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'Test Agent');
    await user.type(screen.getByLabelText(/^soul/i), 'Soul content here');
    await user.type(screen.getByLabelText(/^identity/i), 'Identity content here');

    await user.click(screen.getByRole('button', { name: /create agent/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/agents');
    });
  });

  it('shows error message on failure', async () => {
    mockCreateAgent.mockResolvedValue({ error: 'Slug already taken' });
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'Test Agent');
    await user.type(screen.getByLabelText(/^soul/i), 'Soul content');
    await user.type(screen.getByLabelText(/^identity/i), 'Identity content');

    await user.click(screen.getByRole('button', { name: /create agent/i }));

    await waitFor(() => {
      expect(screen.getByText('Slug already taken')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Cancel navigates to /agents', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockPush).toHaveBeenCalledWith('/agents');
  });
});
