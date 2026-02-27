import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from '../connection-status';

vi.mock('@/app/_components/ws-provider', () => ({
  useWs: vi.fn(() => ({ lastEvent: null, isConnected: false })),
}));

import { useWs } from '@/app/_components/ws-provider';

const mockUseWs = vi.mocked(useWs);

describe('ConnectionStatus', () => {
  it('shows connected state with username from initial props', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: true });

    render(<ConnectionStatus pluginName='discord' initialState={{ connected: true, username: 'HarnessBot#1234' }} />);

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByText(/HarnessBot#1234/)).toBeInTheDocument();
  });

  it('shows disconnected state from initial props', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    render(<ConnectionStatus pluginName='discord' initialState={{ connected: false }} />);

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
    expect(screen.queryByText(/as /)).not.toBeInTheDocument();
  });

  it('updates to connected when WebSocket event fires', async () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    const { rerender } = render(<ConnectionStatus pluginName='discord' initialState={{ connected: false }} />);

    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();

    mockUseWs.mockReturnValue({
      lastEvent: { connected: true, username: 'HarnessBot#1234' },
      isConnected: true,
    });

    await act(async () => {
      rerender(<ConnectionStatus pluginName='discord' initialState={{ connected: false }} />);
    });

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('subscribes to the correct event name based on pluginName', () => {
    mockUseWs.mockReturnValue({ lastEvent: null, isConnected: false });

    render(<ConnectionStatus pluginName='discord' initialState={{ connected: false }} />);

    expect(mockUseWs).toHaveBeenCalledWith('discord:connection');
  });
});
