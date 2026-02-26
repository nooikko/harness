import type { InvokeResult } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { persistPipelineComplete } from '../persist-pipeline-complete';

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

const makeInvokeResult = (overrides: Partial<InvokeResult> = {}): InvokeResult => ({
  output: 'done',
  durationMs: 1234,
  exitCode: 0,
  inputTokens: 100,
  outputTokens: 50,
  ...overrides,
});

describe('persistPipelineComplete', () => {
  it('creates a pipeline_complete status message with metrics', async () => {
    const db = makeDb();
    const result = makeInvokeResult({ durationMs: 800, inputTokens: 200, outputTokens: 75 });

    await persistPipelineComplete(db as never, 'thread-1', result);

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'system',
        kind: 'status',
        source: 'pipeline',
        content: 'Pipeline completed',
        metadata: {
          event: 'pipeline_complete',
          durationMs: 800,
          inputTokens: 200,
          outputTokens: 75,
        },
      },
    });
  });

  it('uses null for missing token counts', async () => {
    const db = makeDb();
    const result = makeInvokeResult({ inputTokens: undefined, outputTokens: undefined });

    await persistPipelineComplete(db as never, 'thread-1', result);

    expect(db.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ inputTokens: null, outputTokens: null }),
      }),
    });
  });
});
