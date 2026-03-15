import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchFilterChips } from '../search-filter-chips';

describe('SearchFilterChips', () => {
  it('renders nothing when no filters are active', () => {
    const { container } = render(<SearchFilterChips filters={{}} onRemoveFilter={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a badge for the agent filter', () => {
    render(<SearchFilterChips filters={{ agent: 'primary' }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('agent: primary')).toBeInTheDocument();
  });

  it('renders badges for multiple filters', () => {
    render(<SearchFilterChips filters={{ agent: 'primary', project: 'harness', hasFile: true }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('agent: primary')).toBeInTheDocument();
    expect(screen.getByText('project: harness')).toBeInTheDocument();
    expect(screen.getByText('has: file')).toBeInTheDocument();
  });

  it('calls onRemoveFilter with correct key when X clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<SearchFilterChips filters={{ agent: 'primary', project: 'harness' }} onRemoveFilter={onRemove} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]!);
    expect(onRemove).toHaveBeenCalledWith('agent');
  });

  it('renders role filter', () => {
    render(<SearchFilterChips filters={{ role: 'user' }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('from: user')).toBeInTheDocument();
  });

  it("renders thread filter as 'in:'", () => {
    render(<SearchFilterChips filters={{ thread: 'general' }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('in: general')).toBeInTheDocument();
  });

  it('renders date filters with formatted dates', () => {
    render(
      <SearchFilterChips
        filters={{
          before: new Date('2026-03-15'),
          after: new Date('2026-03-01'),
        }}
        onRemoveFilter={vi.fn()}
      />,
    );
    expect(screen.getByText('before: 2026-03-15')).toBeInTheDocument();
    expect(screen.getByText('after: 2026-03-01')).toBeInTheDocument();
  });

  it('renders file name filter', () => {
    render(<SearchFilterChips filters={{ fileName: 'report.pdf' }} onRemoveFilter={vi.fn()} />);
    expect(screen.getByText('file: report.pdf')).toBeInTheDocument();
  });
});
