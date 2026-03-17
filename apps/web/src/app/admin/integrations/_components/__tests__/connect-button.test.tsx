import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockConnectMicrosoft = vi.fn();
vi.mock('../../_actions/connect-microsoft', () => ({
  connectMicrosoft: mockConnectMicrosoft,
}));

const { ConnectButton } = await import('../connect-button');

describe('ConnectButton', () => {
  it('renders Connect Account text', () => {
    render(<ConnectButton />);
    expect(screen.getByText('Connect Account')).toBeInTheDocument();
  });

  it('calls connectMicrosoft on click', async () => {
    const user = userEvent.setup();
    mockConnectMicrosoft.mockResolvedValue(undefined);

    render(<ConnectButton />);
    await user.click(screen.getByText('Connect Account'));

    expect(mockConnectMicrosoft).toHaveBeenCalled();
  });
});
