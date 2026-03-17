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
    expect(screen.getByText(/0\.5s/)).toBeInTheDocument();
  });

  it('shows tool name in header when provided', () => {
    render(<ToolResultBlock content='done' metadata={{ toolName: 'music__search' }} />);
    expect(screen.getByText(/search/)).toBeInTheDocument();
  });

  it('shows tool name and duration together', () => {
    render(<ToolResultBlock content='done' metadata={{ toolName: 'music__search', durationMs: 1200 }} />);
    expect(screen.getByText(/search.*1\.2s/)).toBeInTheDocument();
  });

  it('shows error indicator for error content', async () => {
    const user = userEvent.setup();
    render(<ToolResultBlock content='Error: 400 Bad Request from YouTube Music API' />);
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('⚠');
    await user.click(button);
    expect(screen.getByText(/400 Bad Request/)).toBeInTheDocument();
  });

  it('shows error indicator for failed content', () => {
    render(<ToolResultBlock content='Failed to search: connection refused' />);
    expect(screen.getByRole('button').textContent).toContain('⚠');
  });

  it('does not show error indicator for normal content', () => {
    render(<ToolResultBlock content='Found 5 results' />);
    expect(screen.getByRole('button').textContent).not.toContain('⚠');
  });
});
