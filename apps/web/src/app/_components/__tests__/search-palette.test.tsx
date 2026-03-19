import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stub scrollIntoView for cmdk
Element.prototype.scrollIntoView = vi.fn();

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock cmdk components to avoid internal filtering behavior
vi.mock('@harness/ui', async () => {
  const React = await import('react');
  return {
    CommandDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role='dialog'>{children}</div> : null),
    CommandInput: (props: { placeholder?: string; value?: string; onValueChange?: (v: string) => void }) => (
      <input placeholder={props.placeholder} value={props.value} onChange={(e) => props.onValueChange?.(e.target.value)} />
    ),
    CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandGroup: ({ heading, children }: { heading: React.ReactNode; children: React.ReactNode }) => (
      <div>
        <div>{heading}</div>
        {children}
      </div>
    ),
    CommandItem: ({ children, onSelect, className }: { children: React.ReactNode; onSelect?: () => void; className?: string; value?: string }) => (
      // biome-ignore lint/a11y/useKeyWithClickEvents: test mock
      <div role='option' onClick={onSelect} className={className} tabIndex={0}>
        {children}
      </div>
    ),
    CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CommandFooter: () => <div />,
    Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
      <span data-variant={variant} className={className}>
        {children}
      </span>
    ),
  };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Must import after mocks
const { SearchPalette } = await import('../search-palette');

describe('SearchPalette', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    mockPush.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the search input when open', () => {
    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows recent searches when query is empty and recents exist', () => {
    localStorage.setItem('harness:recent-searches', JSON.stringify(['test query']));
    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('test query')).toBeInTheDocument();
  });

  it('shows "type at least 2 characters" for short queries', async () => {
    const user = userEvent.setup();
    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'a');
    expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();
  });

  it('displays search results grouped by type', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'thread',
            id: 't1',
            title: 'Test Thread',
            preview: 'A thread about testing',
            score: 0.9,
            meta: { threadId: 't1', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    // Type "test" which matches the cmdk value "thread-t1-Test Thread"
    await user.type(input, 'test');

    await vi.waitFor(() => {
      // Text is split by <mark> highlight elements, so use a function matcher
      expect(screen.getByText((_content, el) => el?.textContent === 'Test Thread')).toBeInTheDocument();
    });
  });

  it('shows "no results" when search returns empty', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'xyz nothing here');

    await vi.waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('shows filter chips when filters are typed', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'agent:primary test');

    await vi.waitFor(() => {
      expect(screen.getByText('agent: primary')).toBeInTheDocument();
    });
  });

  it('shows clear button for recent searches', () => {
    localStorage.setItem('harness:recent-searches', JSON.stringify(['old query']));
    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('navigates to thread on result select', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'thread',
            id: 't1',
            title: 'My Thread',
            preview: 'preview text',
            score: 0.9,
            meta: { threadId: 't1', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    const onOpenChange = vi.fn();
    render(<SearchPalette open={true} onOpenChange={onOpenChange} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'my thread');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).toHaveBeenCalledWith('/chat/t1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates to agent page on agent result select', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'agent',
            id: 'a1',
            title: 'Agent One',
            preview: '@agent',
            score: 0.8,
            meta: { agentName: 'Agent One', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'agent one');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).toHaveBeenCalledWith('/agents/a1');
  });

  it('navigates to project page on project result select', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'project',
            id: 'p1',
            title: 'Project X',
            preview: 'A cool project',
            score: 0.7,
            meta: { projectName: 'Project X', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'project');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).toHaveBeenCalledWith('/chat/projects/p1');
  });

  it('navigates to thread for message results', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'message',
            id: 'm1',
            title: 'Message result',
            preview: 'some content',
            score: 0.6,
            meta: { threadId: 't99', threadName: 'Thread', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'message');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).toHaveBeenCalledWith('/chat/t99?highlight=m1');
  });

  it('navigates to thread for file results', async () => {
    const user = userEvent.setup();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'file',
            id: 'f1',
            title: 'report.pdf',
            preview: 'PDF file',
            score: 0.5,
            meta: { threadId: 't55', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'report');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).toHaveBeenCalledWith('/chat/t55');
  });

  it('selects a recent search and triggers search', async () => {
    const user = userEvent.setup();
    localStorage.setItem('harness:recent-searches', JSON.stringify(['old query']));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const recentItem = screen.getByText('old query').closest('[role="option"]')!;
    await user.click(recentItem);

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('removes a filter chip and updates the query', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'agent:primary test');

    await vi.waitFor(() => {
      expect(screen.getByText('agent: primary')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /remove agent/i });
    await user.click(removeBtn);

    // After removing the filter, the input should have just "test"
    expect(input).toHaveValue('test');
  });

  it('clears recent searches', async () => {
    const user = userEvent.setup();
    localStorage.setItem('harness:recent-searches', JSON.stringify(['query1', 'query2']));

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('query1')).toBeInTheDocument();

    await user.click(screen.getByText('Clear'));

    expect(screen.queryByText('query1')).not.toBeInTheDocument();
  });

  it('removes individual recent search on X click', async () => {
    const user = userEvent.setup();
    localStorage.setItem('harness:recent-searches', JSON.stringify(['keep', 'remove']));

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const removeBtn = screen.getByRole('button', { name: /remove remove from recent/i });
    await user.click(removeBtn);

    expect(screen.queryByText('remove')).not.toBeInTheDocument();
    expect(screen.getByText('keep')).toBeInTheDocument();
  });

  it('handles fetch failure gracefully', async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'test query');

    await vi.waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('shows project and agent metadata on results', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'thread',
            id: 't1',
            title: 'Thread',
            preview: 'preview',
            score: 0.9,
            meta: {
              threadId: 't1',
              projectName: 'My Project',
              agentName: 'Bot',
              createdAt: '2026-03-15T00:00:00Z',
            },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'thread');

    await vi.waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('@Bot')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    const { container } = render(<SearchPalette open={false} onOpenChange={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not navigate for message with no threadId', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'message',
            id: 'm1',
            title: 'Orphan message',
            preview: 'no thread',
            score: 0.5,
            meta: { createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'orphan');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate for file with no threadId', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'file',
            id: 'f1',
            title: 'loose.pdf',
            preview: 'no thread',
            score: 0.5,
            meta: { createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'loose');

    await vi.waitFor(() => {
      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('option'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles non-ok fetch response', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'server error');

    await vi.waitFor(() => {
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });
  });

  it('does not show recents when loading', async () => {
    localStorage.setItem('harness:recent-searches', JSON.stringify(['old']));
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'te');

    // While loading, recents should not show
    await vi.waitFor(() => {
      expect(screen.queryByText('old')).not.toBeInTheDocument();
    });
  });

  it('highlights matched terms in results', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            type: 'thread',
            id: 't1',
            title: 'Deploy Report',
            preview: 'Weekly deploy report summary',
            score: 0.9,
            meta: { threadId: 't1', createdAt: '2026-03-15T00:00:00Z' },
          },
        ],
      }),
    });

    render(<SearchPalette open={true} onOpenChange={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'deploy');

    await vi.waitFor(() => {
      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
    });
  });
});
