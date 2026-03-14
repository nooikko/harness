import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { CodeBlock } from '../code-block';

// jsdom lacks clipboard API — provide a minimal stub so handleCopy doesn't throw
beforeAll(() => {
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.resolve() },
      configurable: true,
    });
  }
});

describe('CodeBlock', () => {
  it('renders code with syntax highlighting', () => {
    render(<CodeBlock language='javascript'>const x = 1;</CodeBlock>);
    expect(screen.getByText(/const/)).toBeInTheDocument();
  });

  it('displays the language badge', () => {
    render(<CodeBlock language='python'>print("hi")</CodeBlock>);
    expect(screen.getByText('python')).toBeInTheDocument();
  });

  it('renders a copy button', () => {
    render(<CodeBlock language='bash'>echo hello</CodeBlock>);
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument();
  });

  it('shows "Copied" feedback after clicking copy', async () => {
    const user = userEvent.setup();

    render(<CodeBlock language='bash'>echo hello</CodeBlock>);
    expect(screen.getByLabelText('Copy code')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Copy code'));

    await waitFor(() => {
      expect(screen.getByLabelText('Copied')).toBeInTheDocument();
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('renders inside a pre element', () => {
    const { container } = render(<CodeBlock language='ts'>const a = 1;</CodeBlock>);
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('renders short blocks expanded (no collapsible)', () => {
    const shortCode = 'line 1\nline 2\nline 3';
    render(<CodeBlock language='text'>{shortCode}</CodeBlock>);
    expect(screen.getByText('text')).toBeInTheDocument();
    // Only the copy button should exist, no collapsible toggle
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders long blocks collapsed inside CollapsibleBlock', () => {
    const lines = Array.from({ length: 35 }, (_, i) => `line ${i + 1}`).join('\n');
    render(<CodeBlock language='python'>{lines}</CodeBlock>);

    // CollapsibleBlock header should show language + line count
    expect(screen.getByText(/python/)).toBeInTheDocument();
    expect(screen.getByText(/35 lines/)).toBeInTheDocument();

    // Collapsed by default
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands long blocks on click', async () => {
    const user = userEvent.setup();
    const lines = Array.from({ length: 35 }, (_, i) => `line ${i + 1}`).join('\n');
    render(<CodeBlock language='python'>{lines}</CodeBlock>);

    const toggle = screen.getByRole('button');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('strips trailing newline from displayed code', () => {
    const { container } = render(<CodeBlock language='bash'>{'echo hello\n'}</CodeBlock>);
    const code = container.querySelector('code');
    // The rendered code text should not end with a blank line
    const text = code?.textContent ?? '';
    expect(text.trimEnd()).toBe('echo hello');
  });

  it('handles unknown languages gracefully', () => {
    render(<CodeBlock language='foobar'>some content</CodeBlock>);
    expect(screen.getByText(/some content/)).toBeInTheDocument();
    expect(screen.getByText('foobar')).toBeInTheDocument();
  });
});
