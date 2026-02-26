import type { PipelineStep } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { persistPipelineSteps } from '../persist-pipeline-steps';

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe('persistPipelineSteps', () => {
  it('creates a pipeline_step message per step', async () => {
    const db = makeDb();
    const steps: PipelineStep[] = [
      { step: 'onMessage', timestamp: 1000 },
      { step: 'invoking', detail: 'claude-sonnet-4-6 | 3,000 chars', timestamp: 2000 },
    ];

    await persistPipelineSteps(db as never, 'thread-1', steps);

    expect(db.message.create).toHaveBeenCalledTimes(2);
    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'system',
        kind: 'pipeline_step',
        source: 'pipeline',
        content: 'onMessage',
        metadata: { step: 'onMessage', detail: null },
      },
    });
    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'system',
        kind: 'pipeline_step',
        source: 'pipeline',
        content: 'invoking',
        metadata: { step: 'invoking', detail: 'claude-sonnet-4-6 | 3,000 chars' },
      },
    });
  });

  it('spreads step.metadata into the DB message metadata', async () => {
    const db = makeDb();
    const steps: PipelineStep[] = [
      {
        step: 'invoking',
        detail: 'claude-sonnet-4-6 | 3,000 chars',
        metadata: { model: 'claude-sonnet-4-6', promptLength: 3000 },
        timestamp: 1000,
      },
    ];

    await persistPipelineSteps(db as never, 'thread-1', steps);

    expect(db.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          step: 'invoking',
          model: 'claude-sonnet-4-6',
          promptLength: 3000,
        }),
      }),
    });
  });

  it('does nothing for empty steps array', async () => {
    const db = makeDb();
    await persistPipelineSteps(db as never, 'thread-1', []);
    expect(db.message.create).not.toHaveBeenCalled();
  });
});
