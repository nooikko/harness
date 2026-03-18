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

describe('getActivePipeline', () => {
  it('returns active: false when no pipeline_start exists', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: false when a matching pipeline_complete exists', async () => {
    const now = new Date();
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'msg-start',
        metadata: { event: 'pipeline_start', traceId: 'trace-1', startedAt: now.toISOString() },
        createdAt: now,
      } as never)
      .mockResolvedValueOnce({
        id: 'msg-complete',
      } as never);

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false });
  });

  it('returns active: true with startedAt and traceId when pipeline is in progress', async () => {
    const now = new Date();
    const startedAt = now.toISOString();
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'msg-start',
        metadata: { event: 'pipeline_start', traceId: 'trace-abc', startedAt },
        createdAt: now,
      } as never)
      .mockResolvedValueOnce(null); // no completion

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: true, startedAt, traceId: 'trace-abc' });
  });

  it('returns timedOut: true when pipeline_start is older than 10 minutes', async () => {
    const staleDate = new Date(Date.now() - 11 * 60 * 1000);
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'msg-start',
        metadata: { event: 'pipeline_start', traceId: 'trace-old', startedAt: staleDate.toISOString() },
        createdAt: staleDate,
      } as never)
      .mockResolvedValueOnce(null); // no completion

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: false, timedOut: true });
  });

  it('falls back to createdAt when metadata has no startedAt', async () => {
    const now = new Date();
    mockFindFirst
      .mockResolvedValueOnce({
        id: 'msg-start',
        metadata: { event: 'pipeline_start', traceId: 'trace-no-started' },
        createdAt: now,
      } as never)
      .mockResolvedValueOnce(null);

    const result = await getActivePipeline('thread-1');

    expect(result).toEqual({ active: true, startedAt: now.toISOString(), traceId: 'trace-no-started' });
  });
});
