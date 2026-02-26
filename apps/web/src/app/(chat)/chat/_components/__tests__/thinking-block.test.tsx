import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThinkingBlock } from '../thinking-block';

describe('ThinkingBlock', () => {
  it('renders collapsed by default with Thinking header', () => {
    render(<ThinkingBlock content='Deep reasoning here' />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
    expect(screen.queryByText('Deep reasoning here')).not.toBeInTheDocument();
  });

  it('expands to show content on click', async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock content='Deep reasoning here' />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Deep reasoning here')).toBeInTheDocument();
  });

  it('collapses again on second click', async () => {
    const user = userEvent.setup();
    render(<ThinkingBlock content='Deep reasoning here' />);
    const button = screen.getByRole('button');
    await user.click(button);
    await user.click(button);
    expect(screen.queryByText('Deep reasoning here')).not.toBeInTheDocument();
  });
});
