import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChatIndexPage from '../page';

describe('ChatIndexPage', () => {
  it('renders the select a thread heading', () => {
    render(<ChatIndexPage />);
    expect(screen.getByRole('heading', { name: 'Select a thread' })).toBeInTheDocument();
  });

  it('renders the instruction text', () => {
    render(<ChatIndexPage />);
    expect(screen.getByText(/Choose a thread from the sidebar/)).toBeInTheDocument();
  });
});
