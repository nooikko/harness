import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Must be hoisted above the component import so Vitest can intercept the module
vi.mock('../content-blocks/registry', () => ({
  getBlockRenderer: vi.fn(),
}));

import { getBlockRenderer } from '../content-blocks/registry';
import { ToolResultBlock } from '../tool-result-block';

// Cast to a writable mock so individual tests can configure return values
const mockGetBlockRenderer = getBlockRenderer as ReturnType<typeof vi.fn>;

// A minimal synchronous block renderer used in tests that need a known block type.
// Using a plain component (not React.lazy) eliminates async resolution complexity
// while still exercising the Suspense wrapper code path.
type FakeBlockProps = { data: Record<string, unknown> };
const FakeEmailListBlock = ({ data }: FakeBlockProps) => <div data-testid='email-list-block'>{(data.emails as unknown[])?.length ?? 0} emails</div>;

describe('ToolResultBlock', () => {
  // --- Existing backward-compat tests (no metadata.blocks) ---

  it('renders collapsed by default', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='output text here' />);
    expect(screen.queryByText('output text here')).not.toBeInTheDocument();
  });

  it('expands to show output on click', async () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    const user = userEvent.setup();
    render(<ToolResultBlock content='output text here' />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('output text here')).toBeInTheDocument();
  });

  it('shows a Result header', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='done' />);
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });

  it('shows duration in header when provided', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='done' metadata={{ durationMs: 500 }} />);
    expect(screen.getByText(/0\.5s/)).toBeInTheDocument();
  });

  it('shows tool name in header when provided', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='done' metadata={{ toolName: 'music__search' }} />);
    expect(screen.getByText(/search/)).toBeInTheDocument();
  });

  it('shows tool name and duration together', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='done' metadata={{ toolName: 'music__search', durationMs: 1200 }} />);
    expect(screen.getByText(/search.*1\.2s/)).toBeInTheDocument();
  });

  it('shows error indicator for error content', async () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    const user = userEvent.setup();
    render(<ToolResultBlock content='Error: 400 Bad Request from YouTube Music API' />);
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('⚠');
    await user.click(button);
    expect(screen.getByText(/400 Bad Request/)).toBeInTheDocument();
  });

  it('shows error indicator for failed content', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='Failed to search: connection refused' />);
    expect(screen.getByRole('button').textContent).toContain('⚠');
  });

  it('does not show error indicator for normal content', () => {
    mockGetBlockRenderer.mockReturnValue(undefined);
    render(<ToolResultBlock content='Found 5 results' />);
    expect(screen.getByRole('button').textContent).not.toContain('⚠');
  });

  // --- No blocks: backward compatibility ---

  describe('when metadata.blocks is absent', () => {
    it('renders raw content in a pre element when expanded', async () => {
      mockGetBlockRenderer.mockReturnValue(undefined);
      const user = userEvent.setup();
      render(<ToolResultBlock content='raw output data' />);
      await user.click(screen.getByRole('button'));
      const pre = screen.getByText('raw output data');
      expect(pre.tagName).toBe('PRE');
    });

    it('renders collapsed with a toggle button', () => {
      mockGetBlockRenderer.mockReturnValue(undefined);
      render(<ToolResultBlock content='collapsed content' />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.queryByText('collapsed content')).not.toBeInTheDocument();
    });

    it('error detection applies warning styling when content contains "error"', () => {
      mockGetBlockRenderer.mockReturnValue(undefined);
      render(<ToolResultBlock content='Error: something went wrong' />);
      expect(screen.getByRole('button').textContent).toContain('⚠');
    });

    it('error detection applies warning styling when content contains "failed"', () => {
      mockGetBlockRenderer.mockReturnValue(undefined);
      render(<ToolResultBlock content='Failed to connect to database' />);
      expect(screen.getByRole('button').textContent).toContain('⚠');
    });

    it('does not apply warning styling for successful content without error keywords', () => {
      mockGetBlockRenderer.mockReturnValue(undefined);
      render(<ToolResultBlock content='Successfully retrieved 10 records' />);
      expect(screen.getByRole('button').textContent).not.toContain('⚠');
    });
  });

  // --- With known block type ---

  describe('when metadata.blocks contains a known block type', () => {
    it('renders the Suspense wrapper and resolves to the block renderer', async () => {
      mockGetBlockRenderer.mockReturnValue(FakeEmailListBlock);

      render(<ToolResultBlock content='' metadata={{ blocks: [{ type: 'email-list', data: { emails: [] } }] }} />);

      // The collapsible starts expanded (defaultExpanded) for block layouts
      await waitFor(() => {
        expect(screen.getByTestId('email-list-block')).toBeInTheDocument();
      });
    });

    it('passes block data to the renderer', async () => {
      mockGetBlockRenderer.mockReturnValue(FakeEmailListBlock);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [
              {
                type: 'email-list',
                data: { emails: [{ id: '1' }, { id: '2' }, { id: '3' }] },
              },
            ],
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('email-list-block')).toHaveTextContent('3 emails');
      });
    });

    it('is expanded by default so block content is immediately visible', async () => {
      mockGetBlockRenderer.mockReturnValue(FakeEmailListBlock);

      render(<ToolResultBlock content='' metadata={{ blocks: [{ type: 'email-list', data: { emails: [] } }] }} />);

      // Content is visible without any user interaction
      await waitFor(() => {
        expect(screen.getByTestId('email-list-block')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders the Result label in the block header', async () => {
      mockGetBlockRenderer.mockReturnValue(FakeEmailListBlock);

      render(<ToolResultBlock content='' metadata={{ blocks: [{ type: 'email-list', data: { emails: [] } }] }} />);

      expect(screen.getByText(/result/i)).toBeInTheDocument();
    });

    it('includes tool name and duration in the block header when provided', async () => {
      mockGetBlockRenderer.mockReturnValue(FakeEmailListBlock);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            toolName: 'outlook__list_emails',
            durationMs: 850,
            blocks: [{ type: 'email-list', data: { emails: [] } }],
          }}
        />,
      );

      expect(screen.getByText(/list_emails.*0\.8s/)).toBeInTheDocument();
    });
  });

  // --- With unknown block type ---

  describe('when metadata.blocks contains an unknown block type', () => {
    it('renders JSON of block.data as fallback', async () => {
      mockGetBlockRenderer.mockReturnValue(undefined);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [{ type: 'unknown-type', data: { someKey: 'someValue' } }],
          }}
        />,
      );

      // The block layout is expanded by default
      await waitFor(() => {
        expect(screen.getByText(/"someKey": "someValue"/)).toBeInTheDocument();
      });
    });

    it('renders the JSON fallback inside a pre element', async () => {
      mockGetBlockRenderer.mockReturnValue(undefined);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [{ type: 'unrecognized', data: { count: 42 } }],
          }}
        />,
      );

      await waitFor(() => {
        const pre = screen.getByText(/"count": 42/);
        expect(pre.tagName).toBe('PRE');
      });
    });

    it('calls getBlockRenderer with the block type to attempt lookup', () => {
      mockGetBlockRenderer.mockReturnValue(undefined);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [{ type: 'mystery-block', data: {} }],
          }}
        />,
      );

      expect(mockGetBlockRenderer).toHaveBeenCalledWith('mystery-block');
    });
  });

  // --- Multiple blocks ---

  describe('when metadata.blocks contains multiple blocks', () => {
    it('renders all blocks in sequence', async () => {
      // Return a different renderer per call to verify multiple renders
      type IndexedBlockProps = { data: Record<string, unknown> };
      const BlockA = ({ data }: IndexedBlockProps) => <div data-testid='block-a'>{String(data.label)}</div>;
      const BlockB = ({ data }: IndexedBlockProps) => <div data-testid='block-b'>{String(data.label)}</div>;

      mockGetBlockRenderer.mockReturnValueOnce(BlockA).mockReturnValueOnce(BlockB);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [
              { type: 'type-a', data: { label: 'first' } },
              { type: 'type-b', data: { label: 'second' } },
            ],
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('block-a')).toHaveTextContent('first');
        expect(screen.getByTestId('block-b')).toHaveTextContent('second');
      });
    });

    it('mixes known and unknown block types gracefully', async () => {
      type KnownBlockProps = { data: Record<string, unknown> };
      const KnownBlock = ({ data }: KnownBlockProps) => <div data-testid='known-block'>{String(data.value)}</div>;

      mockGetBlockRenderer
        .mockReturnValueOnce(KnownBlock) // first block: known
        .mockReturnValueOnce(undefined); // second block: unknown -> JSON fallback

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [
              { type: 'known', data: { value: 'hello' } },
              { type: 'unknown', data: { fallback: true } },
            ],
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('known-block')).toHaveTextContent('hello');
        expect(screen.getByText(/"fallback": true/)).toBeInTheDocument();
      });
    });

    it('renders all blocks when every type is unknown (all JSON fallback)', async () => {
      mockGetBlockRenderer.mockReturnValue(undefined);

      render(
        <ToolResultBlock
          content=''
          metadata={{
            blocks: [
              { type: 'unknown-a', data: { x: 1 } },
              { type: 'unknown-b', data: { y: 2 } },
            ],
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/"x": 1/)).toBeInTheDocument();
        expect(screen.getByText(/"y": 2/)).toBeInTheDocument();
      });
    });
  });
});
