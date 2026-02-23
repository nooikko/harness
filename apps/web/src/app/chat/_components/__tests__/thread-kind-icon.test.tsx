import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThreadKindIcon } from '../thread-kind-icon';

describe('ThreadKindIcon', () => {
  it('renders a span with the correct title for primary kind', () => {
    render(<ThreadKindIcon kind='primary' />);
    expect(screen.getByTitle('Primary')).toBeInTheDocument();
  });

  it('renders a span with the correct title for task kind', () => {
    render(<ThreadKindIcon kind='task' />);
    expect(screen.getByTitle('Task')).toBeInTheDocument();
  });

  it('renders a span with the correct title for cron kind', () => {
    render(<ThreadKindIcon kind='cron' />);
    expect(screen.getByTitle('Cron')).toBeInTheDocument();
  });

  it('renders a span with the correct title for general kind', () => {
    render(<ThreadKindIcon kind='general' />);
    expect(screen.getByTitle('General')).toBeInTheDocument();
  });

  it('falls back to the kind string as label for unknown kinds', () => {
    render(<ThreadKindIcon kind='custom' />);
    expect(screen.getByTitle('custom')).toBeInTheDocument();
  });

  it('has an aria-label matching the title', () => {
    render(<ThreadKindIcon kind='primary' />);
    expect(screen.getByLabelText('Primary')).toBeInTheDocument();
  });
});
