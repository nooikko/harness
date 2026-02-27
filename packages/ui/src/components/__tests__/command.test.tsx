import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../command';

describe('Command', () => {
  it('renders Command container', () => {
    render(<Command data-testid='cmd'>content</Command>);
    expect(screen.getByTestId('cmd')).toHaveAttribute('data-slot', 'command');
  });

  it('renders CommandInput with search icon and placeholder', () => {
    render(
      <Command>
        <CommandInput placeholder='Search…' />
      </Command>,
    );
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    // wrapper div has the input wrapper slot
    expect(document.querySelector('[data-slot="command-input-wrapper"]')).toBeInTheDocument();
  });

  it('renders CommandList', () => {
    render(
      <Command>
        <CommandList data-testid='list'>items</CommandList>
      </Command>,
    );
    expect(screen.getByTestId('list')).toHaveAttribute('data-slot', 'command-list');
  });

  it('renders CommandEmpty', () => {
    render(
      <Command>
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('renders CommandGroup with heading', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup heading='Suggestions'>
            <CommandItem>Item one</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Item one')).toBeInTheDocument();
  });

  it('renders CommandItem as a selectable option', () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>My Command</CommandItem>
        </CommandList>
      </Command>,
    );
    expect(screen.getByRole('option', { name: 'My Command' })).toBeInTheDocument();
  });

  it('renders CommandSeparator', () => {
    render(
      <Command>
        <CommandList>
          <CommandSeparator data-testid='sep' />
        </CommandList>
      </Command>,
    );
    expect(screen.getByTestId('sep')).toHaveAttribute('data-slot', 'command-separator');
  });

  it('renders CommandShortcut', () => {
    render(<CommandShortcut>⌘K</CommandShortcut>);
    expect(screen.getByText('⌘K')).toHaveAttribute('data-slot', 'command-shortcut');
  });

  it('filters items based on input', async () => {
    const user = userEvent.setup();
    render(
      <Command>
        <CommandInput placeholder='Search…' />
        <CommandList>
          <CommandItem>Apple</CommandItem>
          <CommandItem>Banana</CommandItem>
          <CommandItem>Cherry</CommandItem>
        </CommandList>
      </Command>,
    );

    await user.type(screen.getByPlaceholderText('Search…'), 'ban');

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
  });

  it('renders CommandDialog with open state', () => {
    render(
      <CommandDialog open onOpenChange={() => {}}>
        <CommandInput placeholder='Type a command…' />
        <CommandList>
          <CommandItem>Action</CommandItem>
        </CommandList>
      </CommandDialog>,
    );
    expect(screen.getByPlaceholderText('Type a command…')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('renders CommandDialog with custom title', () => {
    render(
      <CommandDialog open onOpenChange={() => {}} title='My Palette'>
        <CommandList />
      </CommandDialog>,
    );
    // title is sr-only but exists in DOM
    expect(screen.getByText('My Palette')).toBeInTheDocument();
  });
});
