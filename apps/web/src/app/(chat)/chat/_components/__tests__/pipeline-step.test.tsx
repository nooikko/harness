import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ActivityMessageProps } from '../pipeline-step';
import { LivePipelineStep, PipelineStep } from '../pipeline-step';

type MessageLike = ActivityMessageProps['message'];

type MakeMessage = (overrides?: Partial<MessageLike>) => MessageLike;

const makeMessage: MakeMessage = (overrides = {}) =>
  ({
    id: 'msg-1',
    threadId: 'thread-1',
    role: 'system',
    kind: 'pipeline_step',
    source: 'pipeline',
    content: 'onMessage',
    model: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  }) as MessageLike;

describe('PipelineStep', () => {
  it('renders a checkmark for completed steps', () => {
    render(<PipelineStep message={makeMessage()} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders a human-readable label from STEP_LABELS', () => {
    render(<PipelineStep message={makeMessage({ content: 'invoking' })} />);
    expect(screen.getByText('Calling Claude')).toBeInTheDocument();
  });

  it('renders the raw step key when label is not found', () => {
    render(<PipelineStep message={makeMessage({ content: 'unknown_step' })} />);
    expect(screen.getByText('unknown_step')).toBeInTheDocument();
  });

  it('uses metadata.step over content for label lookup', () => {
    render(
      <PipelineStep
        message={makeMessage({
          content: 'raw-content',
          metadata: { step: 'onBeforeInvoke' },
        })}
      />,
    );
    expect(screen.getByText('Assembling context')).toBeInTheDocument();
  });

  it('renders detail from metadata.detail', () => {
    render(
      <PipelineStep
        message={makeMessage({
          content: 'onBeforeInvoke',
          metadata: { step: 'onBeforeInvoke', detail: 'Custom detail text' },
        })}
      />,
    );
    expect(screen.getByText('Custom detail text')).toBeInTheDocument();
  });
});

describe('LivePipelineStep', () => {
  const makeStep = (step: string, detail?: string) => ({
    step,
    detail,
    timestamp: Date.now(),
  });

  it('renders a spinner when isLatest is true', () => {
    const { container } = render(<LivePipelineStep stepData={makeStep('invoking')} isLatest={true} />);
    // Loader2 renders as an SVG with animate-spin
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders a checkmark when isLatest is false', () => {
    render(<LivePipelineStep stepData={makeStep('invoking')} isLatest={false} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders a human-readable label from STEP_LABELS', () => {
    render(<LivePipelineStep stepData={makeStep('onAfterInvoke')} isLatest={false} />);
    expect(screen.getByText('Processing response')).toBeInTheDocument();
  });

  it('renders the raw step key when label is not found', () => {
    render(<LivePipelineStep stepData={makeStep('custom_step')} isLatest={false} />);
    expect(screen.getByText('custom_step')).toBeInTheDocument();
  });

  it('renders detail when provided', () => {
    render(<LivePipelineStep stepData={makeStep('invoking', 'claude-sonnet-4-6')} isLatest={true} />);
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
  });
});
