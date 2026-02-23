import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../page';

describe('Home page', () => {
  it('renders the dashboard heading', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { level: 1, name: 'Harness Dashboard' })).toBeInTheDocument();
  });

  it('renders the dashboard description', () => {
    render(<Home />);

    expect(screen.getByText(/Monitor threads, tasks, cron jobs/)).toBeInTheDocument();
  });

  it('renders navigation buttons', () => {
    render(<Home />);

    expect(screen.getByRole('button', { name: 'View Threads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Tasks' })).toBeInTheDocument();
  });
});
