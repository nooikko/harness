import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScrollToBottomButton } from '../scroll-to-bottom-button';

describe('ScrollToBottomButton', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(<ScrollToBottomButton isVisible={false} onClick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a button when isVisible is true', () => {
    render(<ScrollToBottomButton isVisible={true} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /scroll to bottom/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ScrollToBottomButton isVisible={true} onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: /scroll to bottom/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
