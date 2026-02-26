import { describe, expect, it, vi } from 'vitest';
import { persistPipelineStart } from '../persist-pipeline-start';

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe('persistPipelineStart', () => {
  it('creates a pipeline_start status message', async () => {
    const db = makeDb();
    await persistPipelineStart(db as never, 'thread-1');

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'system',
        kind: 'status',
        source: 'pipeline',
        content: 'Pipeline started',
        metadata: { event: 'pipeline_start' },
      },
    });
  });
});
