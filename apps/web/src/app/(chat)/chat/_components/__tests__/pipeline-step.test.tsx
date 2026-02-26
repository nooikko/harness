import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders no chevron when metadata has no expandable fields', () => {
    const { container } = render(<PipelineStep message={makeMessage()} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders a chevron and expands to show plugins when metadata.plugins is set', () => {
    render(
      <PipelineStep
        message={makeMessage({
          content: 'onMessage',
          metadata: { step: 'onMessage', plugins: ['context', 'web'] },
        })}
      />,
    );

    // Detail hidden before expand
    expect(screen.queryByText('context, web')).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Plugins')).toBeInTheDocument();
    expect(screen.getByText('context, web')).toBeInTheDocument();
  });

  it('expands to show prompt size delta when promptBefore and promptAfter are set', () => {
    render(
      <PipelineStep
        message={makeMessage({
          content: 'onBeforeInvoke',
          metadata: { step: 'onBeforeInvoke', promptBefore: 1000, promptAfter: 5000 },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('1,000 → 5,000 chars')).toBeInTheDocument();
  });

  it('expands to show model and token counts', () => {
    render(
      <PipelineStep
        message={makeMessage({
          content: 'onAfterInvoke',
          metadata: {
            step: 'onAfterInvoke',
            model: 'claude-sonnet-4-6',
            inputTokens: 1200,
            outputTokens: 300,
            durationMs: 4200,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
    expect(screen.getByText('Input tokens')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('Output tokens')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('4,200ms')).toBeInTheDocument();
  });
});

describe('LivePipelineStep', () => {
  const makeStep = (step: string, metadata?: Record<string, unknown>) => ({
    step,
    metadata,
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

  it('renders no chevron when metadata has no expandable fields', () => {
    const { container } = render(<LivePipelineStep stepData={makeStep('invoking')} isLatest={true} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('expands to show model when metadata.model is set', () => {
    render(<LivePipelineStep stepData={makeStep('invoking', { model: 'claude-sonnet-4-6', promptLength: 3000 })} isLatest={true} />);

    // Detail hidden before expand
    expect(screen.queryByText('claude-sonnet-4-6')).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
    expect(screen.getByText('Prompt')).toBeInTheDocument();
    expect(screen.getByText('3,000 chars')).toBeInTheDocument();
  });
});
