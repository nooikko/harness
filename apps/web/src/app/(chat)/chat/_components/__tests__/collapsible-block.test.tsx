import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CollapsibleBlock } from '../collapsible-block';

describe('CollapsibleBlock', () => {
  it('hides children by default (collapsed)', () => {
    render(<CollapsibleBlock header='My header'>Hidden content</CollapsibleBlock>);
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('shows children when defaultExpanded is true', () => {
    render(
      <CollapsibleBlock header='My header' defaultExpanded>
        Visible content
      </CollapsibleBlock>,
    );
    expect(screen.getByText('Visible content')).toBeInTheDocument();
  });

  it('renders the header content', () => {
    render(<CollapsibleBlock header='Section title'>content</CollapsibleBlock>);
    expect(screen.getByText('Section title')).toBeInTheDocument();
  });

  it('toggles open on click', async () => {
    const user = userEvent.setup();
    render(<CollapsibleBlock header='Toggle me'>Revealed content</CollapsibleBlock>);

    expect(screen.queryByText('Revealed content')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Revealed content')).toBeInTheDocument();
  });

  it('toggles closed on second click', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleBlock header='Toggle me' defaultExpanded>
        Collapsible content
      </CollapsibleBlock>,
    );

    expect(screen.getByText('Collapsible content')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Collapsible content')).not.toBeInTheDocument();
  });

  it('sets aria-expanded correctly', async () => {
    const user = userEvent.setup();
    render(<CollapsibleBlock header='aria test'>content</CollapsibleBlock>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
