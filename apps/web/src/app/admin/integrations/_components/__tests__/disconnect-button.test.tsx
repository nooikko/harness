import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockDisconnectAccount = vi.fn();
vi.mock('../../_actions/disconnect-account', () => ({
  disconnectAccount: mockDisconnectAccount,
}));

const { DisconnectButton } = await import('../disconnect-button');

describe('DisconnectButton', () => {
  it('renders Disconnect text', () => {
    render(<DisconnectButton provider='microsoft' accountId='acc-1' />);
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('calls disconnectAccount with provider and accountId on click', async () => {
    const user = userEvent.setup();
    mockDisconnectAccount.mockResolvedValue(undefined);

    render(<DisconnectButton provider='microsoft' accountId='acc-1' />);
    await user.click(screen.getByText('Disconnect'));

    expect(mockDisconnectAccount).toHaveBeenCalledWith('microsoft', 'acc-1');
  });
});
