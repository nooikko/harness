import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    message: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from '@harness/database';
import { getActivePipeline } from '../get-active-pipeline';

const mockFindFirst = vi.mocked(prisma.message.findFirst);

/** First call finds pipeline_start, next 3 are the parallel completion checks */
const mockStartThenParallel = (start: unknown, complete: unknown, error: unknown, assistant: unknown) => {
  mockFindFirst
    .mockResolvedValueOnce(start as never) // pipeline_start lookup
    .mockResolvedValueOnce(complete as never) // pipeline_complete check
    .mockResolvedValueOnce(error as never) // pipeline error check
    .mockResolvedValueOnce(assistant as never); // assistant text check
};

describe('getActivePipeline', () => {
  it('returns active: false when no pipeline_start exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: false when a matching pipeline_complete exists', async () => {
    const now = new Date();
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: {
          event: 'pipeline_start',
          traceId: 'trace-1',
          startedAt: now.toISOString(),
        },
        createdAt: now,
      },
      { id: 'msg-complete' },
      null,
      null,
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: false when a pipeline error exists', async () => {
    const now = new Date();
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: { traceId: 'trace-err', startedAt: now.toISOString() },
        createdAt: now,
      },
      null,
      { id: 'msg-error' },
      null,
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: false when an assistant response exists after start', async () => {
    const now = new Date();
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: { traceId: 'trace-assist', startedAt: now.toISOString() },
        createdAt: now,
      },
      null,
      null,
      { id: 'msg-assistant' },
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: true with startedAt and traceId when pipeline is in progress', async () => {
    const now = new Date();
    const startedAt = now.toISOString();
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: {
          event: 'pipeline_start',
          traceId: 'trace-abc',
          startedAt,
        },
        createdAt: now,
      },
      null,
      null,
      null,
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: true, startedAt, traceId: 'trace-abc' });
  });

  it('returns timedOut: true when pipeline_start is older than 10 minutes', async () => {
    const staleDate = new Date(Date.now() - 11 * 60 * 1000);
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: {
          event: 'pipeline_start',
          traceId: 'trace-old',
          startedAt: staleDate.toISOString(),
        },
        createdAt: staleDate,
      },
      null,
      null,
      null,
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false, timedOut: true });
  });

  it('falls back to createdAt when metadata has no startedAt', async () => {
    const now = new Date();
    mockStartThenParallel(
      {
        id: 'msg-start',
        metadata: { event: 'pipeline_start', traceId: 'trace-no-started' },
        createdAt: now,
      },
      null,
      null,
      null,
    );

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({
      active: true,
      startedAt: now.toISOString(),
      traceId: 'trace-no-started',
    });
  });
});
