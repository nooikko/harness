import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: mockRefresh, push: mockPush })),
}));

const mockUseWs = vi.fn();

vi.mock('@/app/_components/ws-provider', () => ({
  useWs: (...args: unknown[]) => mockUseWs(...args),
}));

const { ThreadNameRefresher } = await import('../thread-name-refresher');

describe('ThreadNameRefresher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null (no visible output)', () => {
    mockUseWs.mockReturnValue({ lastEvent: null });

    const { container } = render(<ThreadNameRefresher />);

    expect(container.firstChild).toBeNull();
  });

  it('does not call router.refresh when lastEvent is null', () => {
    mockUseWs.mockReturnValue({ lastEvent: null });

    render(<ThreadNameRefresher />);

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('calls router.refresh when lastEvent is present', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-1', name: 'New Name' } });

    render(<ThreadNameRefresher />);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('subscribes to thread:name-updated WebSocket event', () => {
    mockUseWs.mockReturnValue({ lastEvent: null });

    render(<ThreadNameRefresher />);

    expect(mockUseWs).toHaveBeenCalledWith('thread:name-updated');
  });

  it('calls router.refresh each time a new lastEvent arrives', () => {
    mockUseWs.mockReturnValue({ lastEvent: { threadId: 'thread-2' } });

    render(<ThreadNameRefresher />);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
