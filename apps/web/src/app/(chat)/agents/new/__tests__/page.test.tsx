import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../_components/create-agent-form', () => ({
  CreateAgentForm: () => <div data-testid='create-agent-form' />,
}));

import NewAgentPage from '../page';

describe('NewAgentPage', () => {
  it('renders the page heading', () => {
    render(<NewAgentPage />);
    expect(screen.getByText('New Agent')).toBeInTheDocument();
  });

  it('renders the CreateAgentForm', () => {
    render(<NewAgentPage />);
    expect(screen.getByTestId('create-agent-form')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    render(<NewAgentPage />);
    expect(screen.getByText(/new ai agent persona/i)).toBeInTheDocument();
  });
});
