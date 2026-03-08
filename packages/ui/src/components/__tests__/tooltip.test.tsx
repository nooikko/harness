import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip } from '../tooltip';

describe('Tooltip', () => {
  it('renders children', () => {
    render(<Tooltip content='Tooltip text'>Hover me</Tooltip>);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('tooltip content is not visible before hover', () => {
    render(<Tooltip content='Tooltip text'>Hover me</Tooltip>);
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
  });

  it('shows tooltip content when trigger is hovered', async () => {
    const user = userEvent.setup();
    render(<Tooltip content='Tooltip text'>Hover me</Tooltip>);
    await user.hover(screen.getByText('Hover me'));
    expect(screen.getByText('Tooltip text')).toBeInTheDocument();
  });
});
