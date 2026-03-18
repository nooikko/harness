import { describe, expect, it, vi } from 'vitest';
import { persistPipelineStart } from '../persist-pipeline-start';

const makeDb = () => ({
  message: { create: vi.fn().mockResolvedValue({}) },
});

describe('persistPipelineStart', () => {
  it('creates a pipeline_start status message with traceId and startedAt', async () => {
    const db = makeDb();
    await persistPipelineStart(db as never, 'thread-1', 'trace-abc');

    expect(db.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'system',
        kind: 'status',
        source: 'pipeline',
        content: 'Pipeline started',
        metadata: {
          event: 'pipeline_start',
          traceId: 'trace-abc',
          startedAt: expect.any(String),
        },
      },
    });
  });

  it('includes a valid ISO timestamp in startedAt', async () => {
    const db = makeDb();
    await persistPipelineStart(db as never, 'thread-1', 'trace-xyz');

    const metadata = (db.message.create.mock.calls[0]![0] as { data: { metadata: { startedAt: string } } }).data.metadata;
    const parsed = new Date(metadata.startedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
