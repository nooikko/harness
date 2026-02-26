import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusLine } from '../status-line';

describe('StatusLine', () => {
  it('renders pipeline_start content', () => {
    render(<StatusLine content='Pipeline started' metadata={{ event: 'pipeline_start' }} />);
    expect(screen.getByText('Pipeline started')).toBeInTheDocument();
  });

  it('renders pipeline_complete with duration and token metrics', () => {
    render(
      <StatusLine content='Pipeline completed' metadata={{ event: 'pipeline_complete', durationMs: 3200, inputTokens: 500, outputTokens: 200 }} />,
    );
    expect(screen.getByText(/Pipeline completed/)).toBeInTheDocument();
    expect(screen.getByText(/3\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/700 tokens/)).toBeInTheDocument();
  });

  it('renders content without metrics when metadata has no durationMs', () => {
    render(<StatusLine content='Status message' />);
    expect(screen.getByText('Status message')).toBeInTheDocument();
  });

  it('renders duration but no tokens when only durationMs is present', () => {
    render(<StatusLine content='Done' metadata={{ durationMs: 1500 }} />);
    expect(screen.getByText(/1\.5s/)).toBeInTheDocument();
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
  });
});
