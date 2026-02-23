import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollArea } from '../scroll-area';

describe('ScrollArea', () => {
  it('renders children', () => {
    render(
      <ScrollArea>
        <p>Scrollable content</p>
      </ScrollArea>,
    );
    expect(screen.getByText('Scrollable content')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(
      <ScrollArea className='h-48' data-testid='scroll'>
        Content
      </ScrollArea>,
    );
    expect(screen.getByTestId('scroll').className).toContain('h-48');
  });
});
