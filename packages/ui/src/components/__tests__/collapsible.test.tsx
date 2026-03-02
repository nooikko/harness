import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';

describe('Collapsible', () => {
  it('renders without crashing', () => {
    render(<Collapsible data-testid='collapsible'>content</Collapsible>);
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('sets the data-slot attribute on the root', () => {
    render(<Collapsible data-testid='root'>content</Collapsible>);
    expect(screen.getByTestId('root')).toHaveAttribute('data-slot', 'collapsible');
  });

  it('renders children inside the root', () => {
    render(
      <Collapsible>
        <span>hello</span>
      </Collapsible>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('forwards additional props to the root element', () => {
    render(<Collapsible className='my-class' data-testid='root' />);
    expect(screen.getByTestId('root')).toHaveClass('my-class');
  });
});

describe('CollapsibleTrigger', () => {
  it('renders as a button by default', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
      </Collapsible>,
    );
    expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument();
  });

  it('sets the data-slot attribute on the trigger', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger data-testid='trigger'>Toggle</CollapsibleTrigger>
      </Collapsible>,
    );
    expect(screen.getByTestId('trigger')).toHaveAttribute('data-slot', 'collapsible-trigger');
  });
});

describe('CollapsibleContent', () => {
  it('renders content when open', () => {
    render(
      <Collapsible open>
        <CollapsibleContent data-testid='content'>
          <span>Visible content</span>
        </CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('sets the data-slot attribute on the content', () => {
    render(
      <Collapsible open>
        <CollapsibleContent data-testid='content'>body</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByTestId('content')).toHaveAttribute('data-slot', 'collapsible-content');
  });
});

describe('Collapsible open/close behavior', () => {
  it('toggles content visibility when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>
          <span>Hidden content</span>
        </CollapsibleContent>
      </Collapsible>,
    );

    // When closed Radix removes content from the DOM entirely
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(screen.getByText('Hidden content')).toBeInTheDocument();
  });

  it('is open by default when defaultOpen is true', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>
          <span>Open content</span>
        </CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByText('Open content')).toBeVisible();
  });

  it('respects controlled open prop', () => {
    render(
      <Collapsible open={false}>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>
          <span>Controlled content</span>
        </CollapsibleContent>
      </Collapsible>,
    );
    // Radix removes content from DOM when closed
    expect(screen.queryByText('Controlled content')).not.toBeInTheDocument();
  });
});
