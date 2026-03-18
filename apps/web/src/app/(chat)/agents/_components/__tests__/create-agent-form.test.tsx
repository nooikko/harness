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

const mockRewriteWithAi = vi.fn();
vi.mock('../../../chat/_actions/rewrite-with-ai', () => ({
  rewriteWithAi: (...args: unknown[]) => mockRewriteWithAi(...args),
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

  it('shows name and slug in header card when name is entered', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    expect(screen.getByText('New agent')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^name/i), 'Zara');

    expect(screen.queryByText('New agent')).not.toBeInTheDocument();
    expect(screen.getByText('Zara')).toBeInTheDocument();
    expect(screen.getByText('zara')).toBeInTheDocument();
  });

  it('renders role, goal, and backstory fields', () => {
    render(<CreateAgentForm />);
    expect(screen.getByLabelText(/^role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^goal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^backstory/i)).toBeInTheDocument();
  });

  it('submits optional fields when filled in', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'Agent X');
    await user.type(screen.getByLabelText(/^soul/i), 'A noble soul');
    await user.type(screen.getByLabelText(/^identity/i), 'A helpful assistant');
    await user.type(screen.getByLabelText(/^role/i), 'Engineer');
    await user.type(screen.getByLabelText(/^goal/i), 'Ship code');
    await user.type(screen.getByLabelText(/^backstory/i), 'Born in the cloud');

    await user.click(screen.getByRole('button', { name: /create agent/i }));

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'Engineer',
          goal: 'Ship code',
          backstory: 'Born in the cloud',
        }),
      );
    });
  });

  it('sends undefined for empty optional fields', async () => {
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'Agent Y');
    await user.type(screen.getByLabelText(/^soul/i), 'Some soul');
    await user.type(screen.getByLabelText(/^identity/i), 'Some identity');

    await user.click(screen.getByRole('button', { name: /create agent/i }));

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          role: undefined,
          goal: undefined,
          backstory: undefined,
        }),
      );
    });
  });

  it('rewrites soul field via AI', async () => {
    mockRewriteWithAi.mockResolvedValue('Rewritten soul text');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^soul/i), 'Original soul');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    const soulRewriteBtn = rewriteButtons[0]!;
    await user.click(soulRewriteBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^soul/i)).toHaveValue('Rewritten soul text');
    });
    expect(mockRewriteWithAi).toHaveBeenCalledWith('Original soul', 'soul', expect.any(Object));
  });

  it('rewrites identity field via AI', async () => {
    mockRewriteWithAi.mockResolvedValue('Rewritten identity');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^identity/i), 'Original identity');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    const identityRewriteBtn = rewriteButtons[1]!;
    await user.click(identityRewriteBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^identity/i)).toHaveValue('Rewritten identity');
    });
  });

  it('rewrites role field via AI', async () => {
    mockRewriteWithAi.mockResolvedValue('Senior Engineer');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^role/i), 'Engineer');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    const roleRewriteBtn = rewriteButtons[2]!;
    await user.click(roleRewriteBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^role/i)).toHaveValue('Senior Engineer');
    });
  });

  it('rewrites goal field via AI', async () => {
    mockRewriteWithAi.mockResolvedValue('Ship reliable software fast');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^goal/i), 'Ship code');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    const goalRewriteBtn = rewriteButtons[3]!;
    await user.click(goalRewriteBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^goal/i)).toHaveValue('Ship reliable software fast');
    });
  });

  it('rewrites backstory field via AI', async () => {
    mockRewriteWithAi.mockResolvedValue('A legendary origin');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^backstory/i), 'Born in cloud');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    const backstoryRewriteBtn = rewriteButtons[4]!;
    await user.click(backstoryRewriteBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^backstory/i)).toHaveValue('A legendary origin');
    });
  });

  it('keeps original text when rewrite fails', async () => {
    mockRewriteWithAi.mockRejectedValue(new Error('API down'));
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^soul/i), 'Keep this text');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    await user.click(rewriteButtons[0]!);

    await waitFor(() => {
      expect(mockRewriteWithAi).toHaveBeenCalled();
    });

    expect(screen.getByLabelText(/^soul/i)).toHaveValue('Keep this text');
  });

  it('passes context to rewriteWithAi including name, soul, and role', async () => {
    mockRewriteWithAi.mockResolvedValue('Enhanced identity');
    const user = userEvent.setup();
    render(<CreateAgentForm />);

    await user.type(screen.getByLabelText(/^name/i), 'Ada');
    await user.type(screen.getByLabelText(/^soul/i), 'A kind soul');
    await user.type(screen.getByLabelText(/^role/i), 'Mentor');
    await user.type(screen.getByLabelText(/^identity/i), 'Original identity');

    const rewriteButtons = screen.getAllByRole('button', { name: /rewrite/i });
    await user.click(rewriteButtons[1]!);

    await waitFor(() => {
      expect(mockRewriteWithAi).toHaveBeenCalledWith('Original identity', 'identity', {
        soul: 'A kind soul',
        role: 'Mentor',
        name: 'Ada',
      });
    });
  });
});
