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

  it('propagates error when create fails mid-loop and commits prior writes', async () => {
    const db = makeDb();
    db.message.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));

    const steps: PipelineStep[] = [
      { step: 'onMessage', timestamp: 1000 },
      { step: 'invoking', timestamp: 2000 },
      { step: 'onAfterInvoke', timestamp: 3000 },
    ];

    await expect(persistPipelineSteps(db as never, 'thread-1', steps)).rejects.toThrow('write failed');
    // First write succeeded, second threw — third never attempted
    expect(db.message.create).toHaveBeenCalledTimes(2);
  });

  it('includes traceId in metadata when provided', async () => {
    const db = makeDb();
    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];

    await persistPipelineSteps(db as never, 'thread-1', steps, 'trace-abc');

    expect(db.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ traceId: 'trace-abc' }),
      }),
    });
  });

  it('omits traceId from metadata when not provided', async () => {
    const db = makeDb();
    const steps: PipelineStep[] = [{ step: 'onMessage', timestamp: 1000 }];

    await persistPipelineSteps(db as never, 'thread-1', steps);

    const calledData = db.message.create.mock.calls[0]![0].data as { metadata: Record<string, unknown> };
    expect(calledData.metadata).not.toHaveProperty('traceId');
  });
});
