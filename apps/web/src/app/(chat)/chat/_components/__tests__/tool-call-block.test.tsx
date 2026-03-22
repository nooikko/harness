import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolCallBlock } from '../tool-call-block';

describe('ToolCallBlock', () => {
  it('renders the tool name', () => {
    render(<ToolCallBlock content='Read' metadata={{ toolName: 'Read', input: { file: 'test.ts' } }} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('shows input preview in collapsed header', () => {
    render(<ToolCallBlock content='Bash' metadata={{ toolName: 'Bash', input: { command: 'ls -la' } }} />);
    expect(screen.getByText(/ls -la/)).toBeInTheDocument();
  });

  it('strips plugin prefix from display name', () => {
    render(<ToolCallBlock content='delegationPlugin__delegate' metadata={{ toolName: 'delegationPlugin__delegate', input: { prompt: 'test' } }} />);
    expect(screen.getByText('delegate')).toBeInTheDocument();
  });

  it('falls back to content when metadata has no toolName', () => {
    render(<ToolCallBlock content='SomeTool' />);
    expect(screen.getByText('SomeTool')).toBeInTheDocument();
  });

  it('renders non-expandable when no input', () => {
    render(<ToolCallBlock content='Write' metadata={{ toolName: 'Write' }} />);
    expect(screen.getByText('Write')).toBeInTheDocument();
    // Button exists but clicking does nothing (cursor-default, no expand)
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.queryByText(/{/)).not.toBeInTheDocument();
  });

  it('renders non-expandable when input is empty object', () => {
    render(<ToolCallBlock content='Ping' metadata={{ toolName: 'Ping', input: {} }} />);
    expect(screen.getByText('Ping')).toBeInTheDocument();
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.queryByText(/{/)).not.toBeInTheDocument();
  });

  it('renders collapsible when input has fields', () => {
    render(<ToolCallBlock content='search' metadata={{ toolName: 'music__search', input: { query: 'Imagine Dragons' } }} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    // Has chevron indicating expandability
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('expands to show JSON input on click', () => {
    render(<ToolCallBlock content='search' metadata={{ toolName: 'music__search', input: { query: 'test', limit: 5 } }} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByText(/"query": "test"/)).toBeInTheDocument();
    expect(screen.getByText(/"limit": 5/)).toBeInTheDocument();
  });
});
