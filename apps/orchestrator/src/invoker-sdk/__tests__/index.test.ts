import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionPool } from '../_helpers/session-pool';
import { createSdkInvoker } from '../index';

// Mock the helpers
vi.mock('../_helpers/create-session', () => ({
  createSession: vi.fn(),
}));

vi.mock('../_helpers/session-pool', () => ({
  createSessionPool: vi.fn(),
}));

vi.mock('../_helpers/extract-result', () => ({
  extractResult: vi.fn(),
}));

import { extractResult } from '../_helpers/extract-result';
import { createSessionPool } from '../_helpers/session-pool';

const mockCreateSessionPool = vi.mocked(createSessionPool);
const mockExtractResult = vi.mocked(extractResult);

const baseUsage = {
  input_tokens: 100,
  output_tokens: 50,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
} as SDKResultMessage['usage'];

const successResult: SDKResultMessage = {
  type: 'result',
  subtype: 'success',
  duration_ms: 3000,
  duration_api_ms: 2500,
  is_error: false,
  num_turns: 1,
  result: 'Hello!',
  stop_reason: 'end_turn',
  total_cost_usd: 0.01,
  usage: baseUsage,
  modelUsage: {
    'claude-haiku-4-5-20251001': {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      webSearchRequests: 0,
      costUSD: 0.01,
      contextWindow: 200000,
      maxOutputTokens: 8192,
    },
  },
  permission_denials: [],
  uuid: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
  session_id: 'sess-abc',
};

describe('createSdkInvoker', () => {
  let mockSession: Session;
  let mockPool: SessionPool;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      send: vi.fn().mockResolvedValue(successResult),
      close: vi.fn(),
      isAlive: true,
      lastActivity: Date.now(),
    };

    mockPool = {
      get: vi.fn().mockReturnValue(mockSession),
      evict: vi.fn(),
      closeAll: vi.fn(),
      size: vi.fn().mockReturnValue(1),
    };

    mockCreateSessionPool.mockReturnValue(mockPool);

    mockExtractResult.mockReturnValue({
      output: 'Hello!',
      durationMs: 3000,
      exitCode: 0,
      sessionId: 'sess-abc',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  it('creates a session pool with correct config', () => {
    createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    expect(mockCreateSessionPool).toHaveBeenCalledWith({ maxSessions: 8, ttlMs: 480000 }, expect.any(Function), undefined);
  });

  it('passes sessionConfig to session pool when provided', () => {
    const mockServer = { name: 'harness' };
    const sessionConfig = { mcpServerFactory: () => ({ harness: mockServer as never }) };
    createSdkInvoker({
      defaultModel: 'haiku',
      defaultTimeout: 300000,
      sessionConfig,
    });

    expect(mockCreateSessionPool).toHaveBeenCalledWith(expect.any(Object), expect.any(Function), sessionConfig);
  });

  it('invokes using the default model from config', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello');

    expect(mockPool.get).toHaveBeenCalledWith('default', 'haiku');
    expect(mockSession.send).toHaveBeenCalledWith('hello', expect.objectContaining({ meta: expect.any(Object) }));
  });

  it('uses model from options when provided', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello', { model: 'sonnet' });

    expect(mockPool.get).toHaveBeenCalledWith('default', 'sonnet');
  });

  it('falls back to sessionId as pool key when threadId is absent', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello', { sessionId: 'thread-123' });

    expect(mockPool.get).toHaveBeenCalledWith('thread-123', 'haiku');
  });

  it('uses threadId as pool key when provided, ignoring sessionId', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello', { threadId: 'thread-stable', sessionId: 'sess-changes-every-time' });

    expect(mockPool.get).toHaveBeenCalledWith('thread-stable', 'haiku');
  });

  it('returns extracted result on success', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    const result = await invoker.invoke('hello');

    expect(mockExtractResult).toHaveBeenCalledWith(successResult, expect.any(Number));
    expect(result.output).toBe('Hello!');
    expect(result.exitCode).toBe(0);
  });

  it('returns error result and evicts session on send failure', async () => {
    vi.mocked(mockSession.send).mockRejectedValue(new Error('Connection lost'));

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    const result = await invoker.invoke('hello', { sessionId: 'thread-1' });

    expect(result.output).toBe('');
    expect(result.error).toBe('Connection lost');
    expect(result.exitCode).toBe(1);
    expect(mockPool.evict).toHaveBeenCalledWith('thread-1');
  });

  it('evicts using threadId when provided', async () => {
    vi.mocked(mockSession.send).mockRejectedValue(new Error('boom'));
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello', { threadId: 'thread-stable', sessionId: 'sess-xyz' });

    expect(mockPool.evict).toHaveBeenCalledWith('thread-stable');
  });

  it('returns timeout error and evicts session when send exceeds timeout', async () => {
    vi.useFakeTimers();

    // Never-resolving promise to simulate a stuck session
    vi.mocked(mockSession.send).mockReturnValue(new Promise(() => {}));

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 5000 });

    const resultPromise = invoker.invoke('slow prompt');

    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    expect(result.error).toBe('Timed out after 5000ms');
    expect(result.exitCode).toBe(1);
    expect(mockPool.evict).toHaveBeenCalledWith('default');

    vi.useRealTimers();
  });

  it('uses timeout from options when provided', async () => {
    vi.useFakeTimers();

    vi.mocked(mockSession.send).mockReturnValue(new Promise(() => {}));

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    const resultPromise = invoker.invoke('slow prompt', { timeout: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;

    expect(result.error).toBe('Timed out after 1000ms');

    vi.useRealTimers();
  });

  it('forwards onMessage callback to session.send', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const onMessage = vi.fn();

    await invoker.invoke('hello', { onMessage });

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[0]).toBe('hello');
    expect(sendCall?.[1]).toBeDefined();
    expect(typeof sendCall?.[1]?.onMessage).toBe('function');
  });

  it('always passes meta even when onMessage is not provided', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello');

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[0]).toBe('hello');
    expect(sendCall?.[1]).toBeDefined();
    expect(sendCall?.[1]?.meta).toBeDefined();
    expect(sendCall?.[1]?.onMessage).toBeUndefined();
  });

  it('prewarm creates a session in the pool', () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    invoker.prewarm({ threadId: 'thread-warm', model: 'sonnet' });

    expect(mockPool.get).toHaveBeenCalledWith('thread-warm', 'sonnet');
    expect(mockSession.send).not.toHaveBeenCalled();
  });

  it('prewarm uses default model when not specified', () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    invoker.prewarm({ threadId: 'thread-warm-default' });

    expect(mockPool.get).toHaveBeenCalledWith('thread-warm-default', 'haiku');
  });

  it('prewarm and invoke use the same pool key for the same threadId', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    invoker.prewarm({ threadId: 'thread-abc' });
    await invoker.invoke('hello', { threadId: 'thread-abc' });

    const calls = vi.mocked(mockPool.get).mock.calls;
    expect(calls[0]![0]).toBe('thread-abc'); // prewarm call
    expect(calls[1]![0]).toBe('thread-abc'); // invoke call — same key
  });

  it('passes threadId, traceId, and taskId in send meta', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello', { threadId: 'thread-1', traceId: 'trace-abc', taskId: 'task-99' });

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    const meta = sendCall?.[1]?.meta;
    expect(meta).toBeDefined();
    expect(meta?.threadId).toBe('thread-1');
    expect(meta?.traceId).toBe('trace-abc');
    expect(meta?.taskId).toBe('task-99');
  });

  it('passes pendingBlocks from InvokeOptions into send meta', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const pendingBlocks: unknown[][] = [];

    await invoker.invoke('hello', { pendingBlocks: pendingBlocks as never });

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[1]?.meta?.pendingBlocks).toBe(pendingBlocks); // same reference
  });

  it('creates empty pendingBlocks when not provided in options', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello');

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[1]?.meta?.pendingBlocks).toEqual([]);
  });

  it('setPluginContext makes ctx available in send meta', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const fakeCtx = { db: {}, invoker: {} } as never;

    invoker.setPluginContext(fakeCtx);
    await invoker.invoke('hello');

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[1]?.meta?.ctx).toBe(fakeCtx);
  });

  it('meta.ctx is null before setPluginContext is called', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('hello');

    const sendCall = vi.mocked(mockSession.send).mock.calls[0];
    expect(sendCall?.[1]?.meta?.ctx).toBeNull();
  });

  it('retries once on "Session is closed" and succeeds with fresh session', async () => {
    const freshSession: Session = {
      send: vi.fn().mockResolvedValue(successResult),
      close: vi.fn(),
      isAlive: true,
      lastActivity: Date.now(),
    };
    vi.mocked(mockSession.send).mockRejectedValueOnce(new Error('Session is closed'));
    vi.mocked(mockPool.get)
      .mockReturnValueOnce(mockSession) // initial get
      .mockReturnValueOnce(freshSession); // retry get

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const result = await invoker.invoke('hello');

    expect(mockPool.evict).toHaveBeenCalledTimes(1); // evict stale
    expect(mockPool.get).toHaveBeenCalledTimes(2); // initial + retry
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('Hello!');
  });

  it('retries once on "Session is closed" and returns error if retry also fails', async () => {
    const freshSession: Session = {
      send: vi.fn().mockRejectedValue(new Error('Connection lost')),
      close: vi.fn(),
      isAlive: true,
      lastActivity: Date.now(),
    };
    vi.mocked(mockSession.send).mockRejectedValueOnce(new Error('Session is closed'));
    vi.mocked(mockPool.get).mockReturnValueOnce(mockSession).mockReturnValueOnce(freshSession);

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const result = await invoker.invoke('hello');

    expect(mockPool.evict).toHaveBeenCalledTimes(2); // stale + retry failure
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('Connection lost');
  });

  it('does not retry on non-stale errors', async () => {
    vi.mocked(mockSession.send).mockRejectedValue(new Error('Connection lost'));

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const result = await invoker.invoke('hello');

    expect(mockPool.evict).toHaveBeenCalledTimes(1);
    expect(mockPool.get).toHaveBeenCalledTimes(1); // no retry
    expect(result.error).toBe('Connection lost');
  });

  it('does not retry on "Session closed" (intentional close, different message)', async () => {
    vi.mocked(mockSession.send).mockRejectedValue(new Error('Session closed'));

    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });
    const result = await invoker.invoke('hello');

    expect(mockPool.get).toHaveBeenCalledTimes(1); // no retry
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('Session closed');
  });

  it('stop() calls closeAll on the pool', () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    invoker.stop();

    expect(mockPool.closeAll).toHaveBeenCalled();
  });

  it('includes durationMs in the result', async () => {
    const invoker = createSdkInvoker({ defaultModel: 'haiku', defaultTimeout: 300000 });

    await invoker.invoke('timed prompt');

    const extractCall = mockExtractResult.mock.calls[0]!;
    const durationMs = extractCall[1];
    expect(typeof durationMs).toBe('number');
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });
});
