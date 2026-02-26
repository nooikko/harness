import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockCreateMany = vi.fn();

vi.mock('database', () => ({
  prisma: {
    agentRun: { update: (...args: unknown[]) => mockUpdate(...args) },
    metric: { createMany: (...args: unknown[]) => mockCreateMany(...args) },
  },
}));

const { trackTokenUsage } = await import('../index');

describe('trackTokenUsage', () => {
  const db = {
    agentRun: { update: mockUpdate },
    metric: { createMany: mockCreateMany },
  } as never;

  beforeEach(() => {
    mockUpdate.mockReset();
    mockCreateMany.mockReset();
    mockUpdate.mockResolvedValue({});
    mockCreateMany.mockResolvedValue({ count: 4 });
  });

  it('uses heuristic estimation when CLI output has no usage data', async () => {
    const result = await trackTokenUsage(db, {
      agentRunId: 'run-1',
      threadId: 'thread-1',
      model: 'sonnet',
      prompt: 'a'.repeat(400), // ~100 tokens
      output: 'b'.repeat(200), // ~50 tokens
    });

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.costEstimate).toBeGreaterThan(0);
  });

  it('uses CLI-parsed usage when available', async () => {
    const result = await trackTokenUsage(db, {
      agentRunId: 'run-1',
      threadId: 'thread-1',
      model: 'sonnet',
      prompt: 'some prompt',
      output: 'response text\ninput_tokens: 5000\noutput_tokens: 2000\n',
    });

    expect(result.inputTokens).toBe(5000);
    expect(result.outputTokens).toBe(2000);
  });

  it('updates the AgentRun record with token data', async () => {
    await trackTokenUsage(db, {
      agentRunId: 'run-42',
      threadId: 'thread-1',
      model: 'sonnet',
      prompt: 'test',
      output: 'result',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'run-42' },
      data: expect.objectContaining({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        costEstimate: expect.any(Number),
      }),
    });
  });

  it('records metrics for dashboard aggregation', async () => {
    await trackTokenUsage(db, {
      agentRunId: 'run-1',
      threadId: 'thread-5',
      model: 'opus',
      prompt: 'test',
      output: 'result',
    });

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const call = mockCreateMany.mock.calls[0]?.[0];
    expect(call.data).toHaveLength(4);
    expect(call.data[0].threadId).toBe('thread-5');
  });

  it('calculates cost based on model pricing', async () => {
    // Opus: $15/M input, $75/M output
    const result = await trackTokenUsage(db, {
      agentRunId: 'run-1',
      threadId: 'thread-1',
      model: 'opus',
      prompt: 'prompt',
      output: 'input_tokens: 100000\noutput_tokens: 50000\n',
    });

    // 100K * 15/1M + 50K * 75/1M = 1.5 + 3.75 = 5.25
    expect(result.costEstimate).toBeCloseTo(5.25);
  });
});
