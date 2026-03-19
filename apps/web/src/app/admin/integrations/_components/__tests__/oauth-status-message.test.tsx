import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OAuthStatusMessage } from '../oauth-status-message';

describe('OAuthStatusMessage', () => {
  it('renders error message', () => {
    render(<OAuthStatusMessage error='Something went wrong' />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders success message', () => {
    render(<OAuthStatusMessage success />);
    expect(screen.getByText('Account connected successfully.')).toBeInTheDocument();
  });

  it('renders nothing when no props', () => {
    const { container } = render(<OAuthStatusMessage />);
    expect(container.innerHTML).toBe('');
  });
});
