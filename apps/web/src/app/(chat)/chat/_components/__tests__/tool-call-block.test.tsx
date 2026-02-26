import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolCallBlock } from '../tool-call-block';

describe('ToolCallBlock', () => {
  it('renders the tool name', () => {
    render(<ToolCallBlock content='Read' metadata={{ toolName: 'Read' }} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('shows input preview when provided', () => {
    render(<ToolCallBlock content='Bash' metadata={{ toolName: 'Bash', input: { command: 'ls -la' } }} />);
    expect(screen.getByText(/ls -la/)).toBeInTheDocument();
  });

  it('strips plugin prefix from display name', () => {
    render(<ToolCallBlock content='delegationPlugin__delegate' metadata={{ toolName: 'delegationPlugin__delegate' }} />);
    expect(screen.getByText('delegate')).toBeInTheDocument();
  });

  it('falls back to content when metadata has no toolName', () => {
    render(<ToolCallBlock content='SomeTool' />);
    expect(screen.getByText('SomeTool')).toBeInTheDocument();
  });

  it('renders without input preview when metadata has no input', () => {
    render(<ToolCallBlock content='Write' metadata={{ toolName: 'Write' }} />);
    expect(screen.getByText('Write')).toBeInTheDocument();
  });
});
