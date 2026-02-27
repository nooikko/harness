import { render, screen } from '@testing-library/react';
import type { BeautifulMentionsMenuItem } from 'lexical-beautiful-mentions';
import { describe, expect, it } from 'vitest';
import { CommandMenuItem } from '../command-menu-item';

const makeItem = (overrides: Partial<BeautifulMentionsMenuItem> = {}): BeautifulMentionsMenuItem => ({
  trigger: '/',
  value: 'delegate',
  displayValue: 'delegate',
  ...overrides,
});

describe('CommandMenuItem', () => {
  it('renders the command value with a leading slash', () => {
    render(<CommandMenuItem selected={false} label='delegate' itemValue='delegate' item={makeItem()} />);
    expect(screen.getByText('/delegate')).toBeInTheDocument();
  });

  it('shows description when item.data.description is a string', () => {
    render(
      <CommandMenuItem selected={false} label='delegate' itemValue='delegate' item={makeItem({ data: { description: 'Run a sub-agent task' } })} />,
    );
    expect(screen.getByText('Run a sub-agent task')).toBeInTheDocument();
  });

  it('shows args when item.data.args is a string', () => {
    render(<CommandMenuItem selected={false} label='delegate' itemValue='delegate' item={makeItem({ data: { args: '<task description>' } })} />);
    expect(screen.getByText('<task description>')).toBeInTheDocument();
  });

  it('renders neither description nor args spans when data is absent', () => {
    const { container } = render(
      <CommandMenuItem
        selected={false}
        label='current-time'
        itemValue='current-time'
        item={makeItem({ value: 'current-time', displayValue: 'current-time' })}
      />,
    );
    const spans = container.querySelectorAll('span.text-muted-foreground');
    expect(spans).toHaveLength(0);
  });

  it('applies bg-accent class when selected is true', () => {
    const { container } = render(<CommandMenuItem selected={true} label='delegate' itemValue='delegate' item={makeItem()} />);
    const li = container.querySelector('li');
    expect(li?.className).toContain('bg-accent');
  });

  it('applies text-popover-foreground class when selected is false', () => {
    const { container } = render(<CommandMenuItem selected={false} label='delegate' itemValue='delegate' item={makeItem()} />);
    const li = container.querySelector('li');
    expect(li?.className).toContain('text-popover-foreground');
  });

  it('does not pass itemValue as a DOM attribute', () => {
    const { container } = render(<CommandMenuItem selected={false} label='delegate' itemValue='delegate' item={makeItem()} />);
    const li = container.querySelector('li');
    expect(li).not.toHaveAttribute('itemValue');
    expect(li).not.toHaveAttribute('itemvalue');
  });

  it('forwards the ref to the underlying <li>', () => {
    let capturedEl: HTMLLIElement | null = null;
    render(
      <CommandMenuItem
        selected={false}
        label='delegate'
        itemValue='delegate'
        item={makeItem()}
        ref={(el) => {
          capturedEl = el;
        }}
      />,
    );
    expect(capturedEl).toBeInstanceOf(HTMLLIElement);
  });
});
