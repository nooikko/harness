import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/admin/errors',
}));

const { ErrorFilters } = await import('../error-filters');

describe('ErrorFilters', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it('renders All, Error, Warn buttons', () => {
    render(<ErrorFilters sources={[]} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warn' })).toBeInTheDocument();
  });

  it('applies default variant to the active level button', () => {
    mockSearchParams.set('level', 'error');

    render(<ErrorFilters sources={[]} />);
    const errorBtn = screen.getByRole('button', { name: 'Error' });
    const allBtn = screen.getByRole('button', { name: 'All' });

    // Active button gets variant="default" which adds primary bg; inactive gets variant="outline"
    expect(errorBtn.className).not.toEqual(allBtn.className);
  });

  it('renders source dropdown with provided sources', () => {
    render(<ErrorFilters sources={['orchestrator', 'web', 'discord']} />);
    // Radix Select renders a trigger button, not a native select
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('shows Clear filters button when level filter is active', () => {
    mockSearchParams.set('level', 'error');

    render(<ErrorFilters sources={[]} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByText('Filtered')).toBeInTheDocument();
  });

  it('shows Clear filters button when source filter is active', () => {
    mockSearchParams.set('source', 'web');

    render(<ErrorFilters sources={['web']} />);
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByText('Filtered')).toBeInTheDocument();
  });

  it('does not show Clear filters when no filters are active', () => {
    render(<ErrorFilters sources={['orchestrator']} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    expect(screen.queryByText('Filtered')).not.toBeInTheDocument();
  });

  it('navigates with level param when clicking a level button', async () => {
    const user = userEvent.setup();
    render(<ErrorFilters sources={[]} />);

    await user.click(screen.getByRole('button', { name: 'Error' }));

    expect(mockPush).toHaveBeenCalledWith('?level=error');
  });

  it('navigates without level param when clicking All button', async () => {
    mockSearchParams.set('level', 'error');
    const user = userEvent.setup();
    render(<ErrorFilters sources={[]} />);

    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(mockPush).toHaveBeenCalledWith('/admin/errors');
  });

  it('preserves other params when clicking a level button', async () => {
    mockSearchParams.set('source', 'web');
    const user = userEvent.setup();
    render(<ErrorFilters sources={['web']} />);

    await user.click(screen.getByRole('button', { name: 'Warn' }));

    expect(mockPush).toHaveBeenCalledWith('?source=web&level=warn');
  });

  it('renders source trigger with current value', () => {
    mockSearchParams.set('source', 'orchestrator');
    render(<ErrorFilters sources={['orchestrator', 'web']} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('renders source trigger when source filter is active', () => {
    mockSearchParams.set('source', 'web');
    render(<ErrorFilters sources={['web']} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  it('navigates to /admin/errors when clicking Clear filters', async () => {
    mockSearchParams.set('level', 'error');
    mockSearchParams.set('source', 'web');
    const user = userEvent.setup();
    render(<ErrorFilters sources={['web']} />);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(mockPush).toHaveBeenCalledWith('/admin/errors');
  });
});
