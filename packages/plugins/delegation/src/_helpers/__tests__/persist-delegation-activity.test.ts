import type { InvokeResult, InvokeStreamEvent, PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { persistDelegationActivity } from '../persist-delegation-activity';

type MockMessageCreate = ReturnType<typeof vi.fn>;

type CreateMockContext = () => { ctx: PluginContext; messageCreate: MockMessageCreate };

const createMockContext: CreateMockContext = () => {
  const messageCreate = vi.fn().mockResolvedValue({});
  return {
    ctx: {
      db: { message: { create: messageCreate } },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    } as unknown as PluginContext,
    messageCreate,
  };
};

const makeResult = (overrides: Partial<InvokeResult> = {}): InvokeResult => ({
  output: 'Done',
  durationMs: 2000,
  exitCode: 0,
  ...overrides,
});

const makeEvent = (overrides: Partial<InvokeStreamEvent>): InvokeStreamEvent => ({
  type: 'thinking',
  timestamp: 1000,
  ...overrides,
});

describe('persistDelegationActivity', () => {
  it('writes pipeline_start, stream events, and pipeline_complete', async () => {
    const { ctx, messageCreate } = createMockContext();
    const events: InvokeStreamEvent[] = [
      makeEvent({ type: 'thinking', content: 'Reasoning here', timestamp: 1000 }),
      makeEvent({ type: 'tool_call', toolName: 'Bash', toolUseId: 'tu-1', toolInput: { command: 'ls' }, timestamp: 2000 }),
      makeEvent({ type: 'tool_use_summary', content: 'file1.ts\nfile2.ts', toolName: 'Bash', toolUseId: 'tu-1', timestamp: 3000 }),
    ];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult(), 'trace-1');

    // pipeline_start + 3 stream events + pipeline_complete = 5 calls
    expect(messageCreate).toHaveBeenCalledTimes(5);

    // First call: pipeline_start
    const startCall = messageCreate.mock.calls[0]?.[0]?.data;
    expect(startCall.kind).toBe('status');
    expect(startCall.content).toBe('Pipeline started');
    expect(startCall.metadata.event).toBe('pipeline_start');
    expect(startCall.metadata.traceId).toBe('trace-1');

    // Middle calls: thinking, tool_call, tool_result
    const thinkingCall = messageCreate.mock.calls[1]?.[0]?.data;
    expect(thinkingCall.kind).toBe('thinking');
    expect(thinkingCall.content).toBe('Reasoning here');
    expect(thinkingCall.metadata.durationMs).toBe(1000); // 2000 - 1000

    const toolCallData = messageCreate.mock.calls[2]?.[0]?.data;
    expect(toolCallData.kind).toBe('tool_call');
    expect(toolCallData.content).toBe('Bash');
    expect(toolCallData.source).toBe('builtin');
    expect(toolCallData.metadata.toolName).toBe('Bash');
    expect(toolCallData.metadata.input).toEqual({ command: 'ls' });

    const toolResultData = messageCreate.mock.calls[3]?.[0]?.data;
    expect(toolResultData.kind).toBe('tool_result');
    expect(toolResultData.content).toBe('file1.ts\nfile2.ts');
    expect(toolResultData.metadata.durationMs).toBeNull(); // last event

    // Last call: pipeline_complete
    const completeCall = messageCreate.mock.calls[4]?.[0]?.data;
    expect(completeCall.kind).toBe('status');
    expect(completeCall.content).toBe('Pipeline complete');
    expect(completeCall.metadata.event).toBe('pipeline_complete');
    expect(completeCall.metadata.durationMs).toBe(2000);
  });

  it('skips thinking events with empty content', async () => {
    const { ctx, messageCreate } = createMockContext();
    const events: InvokeStreamEvent[] = [
      makeEvent({ type: 'thinking', content: '', timestamp: 1000 }),
      makeEvent({ type: 'thinking', content: undefined, timestamp: 2000 }),
    ];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult());

    // Only pipeline_start + pipeline_complete (no stream events)
    expect(messageCreate).toHaveBeenCalledTimes(2);
  });

  it('skips tool_call events without toolName', async () => {
    const { ctx, messageCreate } = createMockContext();
    const events: InvokeStreamEvent[] = [makeEvent({ type: 'tool_call', toolName: undefined, timestamp: 1000 })];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult());

    expect(messageCreate).toHaveBeenCalledTimes(2);
  });

  it('skips tool_use_summary events without content', async () => {
    const { ctx, messageCreate } = createMockContext();
    const events: InvokeStreamEvent[] = [makeEvent({ type: 'tool_use_summary', content: '', toolName: 'Read', timestamp: 1000 })];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult());

    expect(messageCreate).toHaveBeenCalledTimes(2);
  });

  it('handles empty events array', async () => {
    const { ctx, messageCreate } = createMockContext();

    await persistDelegationActivity(ctx, 'thread-1', [], makeResult());

    // Only pipeline_start + pipeline_complete
    expect(messageCreate).toHaveBeenCalledTimes(2);
  });

  it('omits traceId from metadata when not provided', async () => {
    const { ctx, messageCreate } = createMockContext();

    await persistDelegationActivity(ctx, 'thread-1', [], makeResult());

    const startMeta = messageCreate.mock.calls[0]?.[0]?.data?.metadata;
    expect(startMeta).not.toHaveProperty('traceId');

    const completeMeta = messageCreate.mock.calls[1]?.[0]?.data?.metadata;
    expect(completeMeta).not.toHaveProperty('traceId');
  });

  it('extracts plugin source from qualified tool names', async () => {
    const { ctx, messageCreate } = createMockContext();
    const events: InvokeStreamEvent[] = [makeEvent({ type: 'tool_call', toolName: 'delegation__delegate', timestamp: 1000 })];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult());

    const toolCallData = messageCreate.mock.calls[1]?.[0]?.data;
    expect(toolCallData.source).toBe('delegation');
  });

  it('includes blocks in tool_result metadata when present', async () => {
    const { ctx, messageCreate } = createMockContext();
    const blocks = [{ type: 'email-list', data: { emails: [] } }];
    const events: InvokeStreamEvent[] = [
      makeEvent({
        type: 'tool_use_summary',
        content: 'Result here',
        toolName: 'outlook__search',
        blocks: blocks as unknown as InvokeStreamEvent['blocks'],
        timestamp: 1000,
      }),
    ];

    await persistDelegationActivity(ctx, 'thread-1', events, makeResult());

    const resultMeta = messageCreate.mock.calls[1]?.[0]?.data?.metadata;
    expect(resultMeta.blocks).toEqual(blocks);
  });

  it('includes token counts in pipeline_complete metadata', async () => {
    const { ctx, messageCreate } = createMockContext();
    const result = makeResult({ inputTokens: 500, outputTokens: 200 });

    await persistDelegationActivity(ctx, 'thread-1', [], result);

    const completeMeta = messageCreate.mock.calls[1]?.[0]?.data?.metadata;
    expect(completeMeta.inputTokens).toBe(500);
    expect(completeMeta.outputTokens).toBe(200);
  });
});
