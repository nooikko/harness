import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { ProjectCard } from '../project-card';

const defaultProps = {
  id: 'project-1',
  name: 'My Project',
  description: 'A test project',
  model: 'claude-sonnet-4-20250514',
  threadCount: 3,
  updatedAt: '2026-03-01T00:00:00.000Z',
};

describe('ProjectCard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the project name', () => {
    render(<ProjectCard {...defaultProps} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<ProjectCard {...defaultProps} description='A test project' />);
    expect(screen.getByText('A test project')).toBeInTheDocument();
  });

  it('hides description when null', () => {
    render(<ProjectCard {...defaultProps} description={null} />);
    expect(screen.queryByText('A test project')).not.toBeInTheDocument();
  });

  it('shows thread count with plural', () => {
    render(<ProjectCard {...defaultProps} threadCount={3} />);
    expect(screen.getByText(/3 threads/)).toBeInTheDocument();
  });

  it('shows singular thread count', () => {
    render(<ProjectCard {...defaultProps} threadCount={1} />);
    expect(screen.getByText(/1 thread\b/)).toBeInTheDocument();
  });

  it('shows model badge when model is set', () => {
    render(<ProjectCard {...defaultProps} model='claude-sonnet-4-20250514' />);
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
  });

  it('hides model badge when model is null', () => {
    render(<ProjectCard {...defaultProps} model={null} />);
    expect(screen.queryByText('claude-sonnet-4-20250514')).not.toBeInTheDocument();
  });

  it('navigates to project settings on click', async () => {
    const user = userEvent.setup();
    render(<ProjectCard {...defaultProps} />);

    await user.click(screen.getByText('My Project'));

    expect(mockPush).toHaveBeenCalledWith('/chat/projects/project-1');
  });
});
