import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandMenu } from '../command-menu';

describe('CommandMenu', () => {
  it('renders a <ul> with the provided children', () => {
    render(
      <CommandMenu>
        <li>item one</li>
      </CommandMenu>,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('item one')).toBeInTheDocument();
  });

  it('does not forward the loading prop to the DOM element', () => {
    const { container } = render(
      <CommandMenu loading={true}>
        <li>child</li>
      </CommandMenu>,
    );
    const ul = container.querySelector('ul');
    expect(ul).not.toHaveAttribute('loading');
  });

  it('applies the expected class names', () => {
    const { container } = render(<CommandMenu />);
    const ul = container.querySelector('ul');
    expect(ul?.className).toContain('bg-background');
    expect(ul?.className).toContain('border-border');
    expect(ul?.className).toContain('z-50');
  });

  it('forwards the ref to the underlying <ul>', () => {
    let capturedEl: HTMLUListElement | null = null;
    render(
      <CommandMenu
        ref={(el) => {
          capturedEl = el;
        }}
      />,
    );
    expect(capturedEl).toBeInstanceOf(HTMLUListElement);
  });
});
