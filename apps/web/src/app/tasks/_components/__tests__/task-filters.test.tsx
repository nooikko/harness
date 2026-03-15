import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@harness/database', () => ({}));

import { TaskFilters } from '../task-filters';

describe('TaskFilters', () => {
  it('renders all status filter buttons', () => {
    render(<TaskFilters />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('navigates with status param when a filter is clicked', () => {
    render(<TaskFilters />);

    fireEvent.click(screen.getByText('To Do'));

    expect(mockPush).toHaveBeenCalledWith('/tasks?status=TODO');
  });

  it('removes status param when All is clicked', () => {
    render(<TaskFilters />);

    fireEvent.click(screen.getByText('All'));

    expect(mockPush).toHaveBeenCalledWith('/tasks?');
  });
});
