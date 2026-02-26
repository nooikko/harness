import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolResultBlock } from '../tool-result-block';

describe('ToolResultBlock', () => {
  it('renders collapsed by default', () => {
    render(<ToolResultBlock content='output text here' />);
    expect(screen.queryByText('output text here')).not.toBeInTheDocument();
  });

  it('expands to show output on click', async () => {
    const user = userEvent.setup();
    render(<ToolResultBlock content='output text here' />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('output text here')).toBeInTheDocument();
  });

  it('shows a Result header', () => {
    render(<ToolResultBlock content='done' />);
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });

  it('shows duration in header when provided', () => {
    render(<ToolResultBlock content='done' metadata={{ durationMs: 500 }} />);
    expect(screen.getByText(/result.*0\.5s/i)).toBeInTheDocument();
  });
});
