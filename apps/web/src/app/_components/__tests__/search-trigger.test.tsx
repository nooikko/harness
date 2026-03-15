import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock search-palette to avoid rendering the full dialog
vi.mock('../search-palette', () => ({
  SearchPalette: ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
    <div data-testid='search-palette' data-open={open}>
      <button type='button' onClick={() => onOpenChange(false)}>
        close
      </button>
    </div>
  ),
}));

// Must import after mock
const { SearchTrigger } = await import('../search-trigger');

describe('SearchTrigger', () => {
  it('renders the search button', () => {
    render(<SearchTrigger />);
    expect(screen.getByRole('button', { name: /open command palette/i })).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<SearchTrigger />);
    expect(screen.getByText('⌘K')).toBeInTheDocument();
  });

  it('opens palette on button click', () => {
    render(<SearchTrigger />);
    const btn = screen.getByRole('button', { name: /open command palette/i });
    fireEvent.click(btn);
    expect(screen.getByTestId('search-palette')).toHaveAttribute('data-open', 'true');
  });

  it('opens palette on Cmd+K', () => {
    render(<SearchTrigger />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('search-palette')).toHaveAttribute('data-open', 'true');
  });

  it('opens palette on Ctrl+K', () => {
    render(<SearchTrigger />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('search-palette')).toHaveAttribute('data-open', 'true');
  });

  it('toggles palette closed on second Cmd+K', () => {
    render(<SearchTrigger />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('search-palette')).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByTestId('search-palette')).toHaveAttribute('data-open', 'false');
  });
});
