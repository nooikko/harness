import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let modalProps: { error: unknown; open: boolean; onOpenChange: (v: boolean) => void } | null = null;

vi.mock('../error-detail-modal', () => ({
  ErrorDetailModal: (props: { error: unknown; open: boolean; onOpenChange: (v: boolean) => void }) => {
    modalProps = props;
    return props.open && props.error ? (
      <div data-testid='error-modal'>
        <button type='button' onClick={() => props.onOpenChange(false)}>
          close
        </button>
      </div>
    ) : null;
  },
}));

const { ErrorList } = await import('../error-list');

const makeError = (overrides: Record<string, unknown> = {}) => ({
  id: 'err-1',
  level: 'error',
  source: 'orchestrator',
  message: 'Something went wrong',
  stack: null,
  traceId: null,
  threadId: null,
  metadata: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('ErrorList', () => {
  beforeEach(() => {
    modalProps = null;
    vi.useRealTimers();
  });

  // --- empty state ---
  it('renders empty state when no errors', () => {
    render(<ErrorList errors={[]} />);
    expect(screen.getByText('No errors found')).toBeInTheDocument();
    expect(screen.getByText('Errors will appear here when they are logged.')).toBeInTheDocument();
  });

  // --- table headers ---
  it('renders table headers', () => {
    render(<ErrorList errors={[makeError()]} />);
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  // --- relative time: just now ---
  it("displays 'just now' for errors less than 60 seconds old", () => {
    const createdAt = new Date(Date.now() - 30_000).toISOString();
    render(<ErrorList errors={[makeError({ createdAt })]} />);
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  // --- relative time: minutes ---
  it('displays minutes ago for errors between 1-59 minutes old', () => {
    const createdAt = new Date(Date.now() - 5 * 60_000).toISOString();
    render(<ErrorList errors={[makeError({ createdAt })]} />);
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  // --- relative time: hours ---
  it('displays hours ago for errors between 1-23 hours old', () => {
    const createdAt = new Date(Date.now() - 3 * 3_600_000).toISOString();
    render(<ErrorList errors={[makeError({ createdAt })]} />);
    expect(screen.getByText('3h ago')).toBeInTheDocument();
  });

  // --- relative time: days ---
  it('displays days ago for errors 24+ hours old', () => {
    const createdAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
    render(<ErrorList errors={[makeError({ createdAt })]} />);
    expect(screen.getByText('2d ago')).toBeInTheDocument();
  });

  // --- level badge variant ---
  it('renders error level with destructive badge variant', () => {
    render(<ErrorList errors={[makeError({ level: 'error' })]} />);
    const badge = screen.getByText('error');
    // Badge with variant="destructive" receives a data attribute or class
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('destructive');
  });

  it('renders warn level with warning badge variant', () => {
    render(<ErrorList errors={[makeError({ id: 'w1', level: 'warn' })]} />);
    const badge = screen.getByText('warn');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('warning');
  });

  // --- source badge ---
  it('renders source as an outline badge', () => {
    render(<ErrorList errors={[makeError({ source: 'discord' })]} />);
    const badge = screen.getByText('discord');
    expect(badge).toBeInTheDocument();
  });

  // --- message truncation ---
  it('truncates messages longer than 80 characters', () => {
    const longMsg = 'A'.repeat(100);
    render(<ErrorList errors={[makeError({ message: longMsg })]} />);
    const truncated = `${'A'.repeat(80)}...`;
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });

  it('shows only first line of multiline messages', () => {
    const multilineMsg = 'First line here\nSecond line here\nThird line';
    render(<ErrorList errors={[makeError({ message: multilineMsg })]} />);
    expect(screen.getByText('First line here')).toBeInTheDocument();
    expect(screen.queryByText(/Second line/)).not.toBeInTheDocument();
  });

  it('does not truncate messages within 80 characters', () => {
    const shortMsg = 'Short error message';
    render(<ErrorList errors={[makeError({ message: shortMsg })]} />);
    expect(screen.getByText('Short error message')).toBeInTheDocument();
  });

  // --- multiple rows ---
  it('renders multiple error rows', () => {
    const errors = [makeError({ id: 'e1', message: 'Connection refused' }), makeError({ id: 'e2', message: 'Timeout exceeded' })];
    render(<ErrorList errors={errors} />);
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    expect(screen.getByText('Timeout exceeded')).toBeInTheDocument();
  });

  // --- modal open ---
  it('opens detail modal when row is clicked', async () => {
    const user = userEvent.setup();
    render(<ErrorList errors={[makeError()]} />);

    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();

    const row = screen.getByText('Something went wrong').closest('tr');
    await user.click(row!);

    expect(screen.getByTestId('error-modal')).toBeInTheDocument();
  });

  // --- modal close ---
  it('closes detail modal when onOpenChange fires with false', async () => {
    const user = userEvent.setup();
    render(<ErrorList errors={[makeError()]} />);

    const row = screen.getByText('Something went wrong').closest('tr');
    await user.click(row!);
    expect(screen.getByTestId('error-modal')).toBeInTheDocument();

    await user.click(screen.getByText('close'));
    expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
  });

  // --- modal receives correct error ---
  it('passes clicked error to the detail modal', async () => {
    const user = userEvent.setup();
    const err = makeError({ id: 'specific-id', message: 'Specific error' });
    render(<ErrorList errors={[err]} />);

    const row = screen.getByText('Specific error').closest('tr');
    await user.click(row!);

    expect(modalProps).not.toBeNull();
    expect((modalProps!.error as { id: string }).id).toBe('specific-id');
    expect(modalProps!.open).toBe(true);
  });

  // --- errors with metadata ---
  it('renders rows for errors with various metadata shapes', () => {
    const errors = [
      makeError({ id: 'm1', metadata: null }),
      makeError({ id: 'm2', metadata: { key: 'value' } }),
      makeError({ id: 'm3', metadata: [1, 2, 3] }),
      makeError({ id: 'm4', metadata: 'string-meta' }),
    ];
    render(<ErrorList errors={errors} />);
    // All 4 rows render without crashing
    const rows = screen.getAllByRole('row');
    // 1 header row + 4 data rows
    expect(rows).toHaveLength(5);
  });

  // --- errors with stack, traceId, threadId ---
  it('renders rows for errors with optional fields populated', () => {
    const errors = [
      makeError({
        id: 'full-1',
        stack: 'Error: fail\n  at foo.ts:1',
        traceId: 'trace-abc',
        threadId: 'thread-xyz',
        metadata: { foo: 'bar' },
      }),
    ];
    render(<ErrorList errors={errors} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
